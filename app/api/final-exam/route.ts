import { pgInsert, pgRead } from "@/lib/postgres";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { FINAL_EXAM_PASS_SCORE, FINAL_EXAM_QUESTIONS } from "@/lib/curriculum";
import { issueLearningDocument } from "@/lib/education";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  EXAM_ATTEMPT_COOLDOWN_MS,
  EXAM_MAX_ATTEMPTS_PER_DAY,
  evaluateExamAttemptWindow,
  normalizeFinalExamAnswers
} from "@/lib/learning-security";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function attemptLimitResponse(retryAfterSeconds: number, reason: "cooldown" | "daily_limit") {
  const error = reason === "daily_limit"
    ? "La limite quotidienne de tentatives est atteinte. Revenez demain."
    : "Patientez avant de présenter une nouvelle tentative.";
  const response = NextResponse.json({ ok: false, error }, { status: 429 });
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

async function getContext(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return { response: auth.response };
  const { context, user } = auth;

  const now = new Date().toISOString();
  const [{ data: annualPass }, { data: courseRows, error: courseError }, { data: completedRows, error: completedError }] = await Promise.all([
    pgRead("select t.* from public.\"annual_access_passes\" t where t.\"user_id\" = $1 and t.\"status\" = $2 and t.\"expires_at\" > $3 order by t.\"expires_at\" desc limit $4", [user.id, "active", now, 1], "optional"),
    pgRead("select t.\"id\" from public.\"courses\" t where t.\"statut\" = $1", ["publie"], "many"),
    pgRead("select t.\"module_id\" from public.\"module_progress\" t where t.\"etudiant_id\" = $1 and t.\"complete\" = $2", [user.id, true], "many")
  ]);
  if (courseError) return { error: courseError.message, status: 400 as const };
  if (completedError) return { error: completedError.message, status: 400 as const };

  const courseIds = (courseRows || []).map(row => row.id);
  const { data: moduleRows, error: moduleError } = courseIds.length
    ? await pgRead("select t.\"id\" from public.\"course_modules\" t where t.\"course_id\" = any($1)", [courseIds], "many")
    : { data: [], error: null };
  if (moduleError) return { error: moduleError.message, status: 400 as const };

  const completedIds = new Set((completedRows || []).map(row => row.module_id));
  const modules = moduleRows || [];
  const curriculumCompleted = modules.length > 0 && modules.every(module => completedIds.has(module.id));
  return { annualPass, curriculumCompleted, context, userId: user.id };
}

export async function GET(request: Request) {
  const context = await getContext(request);
  if ("response" in context) return context.response;
  if ("error" in context) return NextResponse.json({ ok: false, error: context.error }, { status: context.status });

  const { data: certificate } = await pgRead("select t.\"id\", t.\"document_number\", t.\"issued_at\" from public.\"learning_documents\" t where t.\"user_id\" = $1 and t.\"document_kind\" = $2", [context.userId, "final_certificate"], "optional");

  return NextResponse.json({
    ok: true,
    annualPassActive: Boolean(context.annualPass),
    certificate,
    eligible: Boolean(context.annualPass) && context.curriculumCompleted,
    passScore: FINAL_EXAM_PASS_SCORE,
    questions: FINAL_EXAM_QUESTIONS.map(({ answer: _answer, ...question }) => question)
  });
}

export async function POST(request: Request) {
  const context = await getContext(request);
  if ("response" in context) return context.response;
  if ("error" in context) return NextResponse.json({ ok: false, error: context.error }, { status: context.status });
  if (!context.annualPass || !context.curriculumCompleted) {
    return NextResponse.json({ ok: false, error: "Terminez l'ensemble du cursus avant de présenter l'examen final." }, { status: 403 });
  }

  const now = Date.now();
  const [{ data: existingCertificate }, { data: latestAttempt, error: latestAttemptError }, recentAttemptsResult] = await Promise.all([
    pgRead("select t.\"id\", t.\"document_number\", t.\"issued_at\" from public.\"learning_documents\" t where t.\"user_id\" = $1 and t.\"document_kind\" = $2", [context.userId, "final_certificate"], "optional"),
    pgRead("select t.\"score\", t.\"passed\", t.\"created_at\" from public.\"final_exam_attempts\" t where t.\"user_id\" = $1 order by t.\"created_at\" desc limit $2", [context.userId, 1], "optional"),
    pgRead("select count(*)::int as count from public.\"final_exam_attempts\" t where t.\"user_id\" = $1 and t.\"created_at\" > $2", [context.userId, new Date(now - ONE_DAY_MS).toISOString()], "count")
  ]);
  if (latestAttemptError || recentAttemptsResult.error) {
    return NextResponse.json({ ok: false, error: "L'historique des tentatives est indisponible." }, { status: 500 });
  }
  if (existingCertificate) {
    return NextResponse.json({ ok: true, certificate: existingCertificate, passed: true, score: Number(latestAttempt?.score || FINAL_EXAM_PASS_SCORE) });
  }
  if (latestAttempt?.passed) {
    const restoredCertificate = await issueLearningDocument(context.context, {
      documentKind: "final_certificate",
      userId: context.userId
    });
    return NextResponse.json({ ok: true, certificate: restoredCertificate, passed: true, score: Number(latestAttempt.score || FINAL_EXAM_PASS_SCORE) });
  }

  const attemptPolicy = evaluateExamAttemptWindow({
    attemptsLastDay: Number(recentAttemptsResult.count || 0),
    latestAttemptAt: latestAttempt?.created_at || null,
    now
  });
  if (!attemptPolicy.allowed) {
    return attemptLimitResponse(attemptPolicy.retryAfterSeconds, attemptPolicy.reason);
  }

  let answers: Record<string, number>;
  try {
    const body = await readJsonBodyWithLimit<{ answers?: unknown }>(request, 32 * 1024);
    answers = normalizeFinalExamAnswers(body?.answers, FINAL_EXAM_QUESTIONS);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Réponses d'examen invalides."
    }, { status: 400 });
  }

  // The database-backed buckets close the race where parallel requests all
  // observe the same latest attempt before any of them inserts a new row.
  const [cooldownGate, dailyGate] = await Promise.all([
    checkRateLimit(`final-exam:cooldown:user:${context.userId}`, 1, EXAM_ATTEMPT_COOLDOWN_MS),
    checkRateLimit(`final-exam:daily:user:${context.userId}`, EXAM_MAX_ATTEMPTS_PER_DAY, ONE_DAY_MS)
  ]);
  if (!dailyGate.allowed) return attemptLimitResponse(dailyGate.retryAfterSeconds, "daily_limit");
  if (!cooldownGate.allowed) return attemptLimitResponse(cooldownGate.retryAfterSeconds, "cooldown");

  const correct = FINAL_EXAM_QUESTIONS.filter(question => Number(answers[question.id]) === question.answer).length;
  const score = Math.round((correct / FINAL_EXAM_QUESTIONS.length) * 100);
  const passed = score >= FINAL_EXAM_PASS_SCORE;

  const { error } = await pgInsert("final_exam_attempts", {
    answers,
    passed,
    score,
    user_id: context.userId
  }, {  });
  if (error) return NextResponse.json({ ok: false, error: "La tentative n'a pas pu être enregistrée." }, { status: 500 });

  const certificate = passed
    ? await issueLearningDocument(context.context, { documentKind: "final_certificate", userId: context.userId })
    : null;

  return NextResponse.json({ ok: true, certificate, passed, score });
}
