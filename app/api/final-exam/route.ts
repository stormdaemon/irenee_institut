import { NextResponse } from "next/server";
import { FINAL_EXAM_PASS_SCORE, FINAL_EXAM_QUESTIONS } from "@/lib/curriculum";
import { issueLearningDocument } from "@/lib/education";
import { createServerClient } from "@/lib/supabase";

async function getContext(request: Request) {
  const supabase = createServerClient();
  if (!supabase) return { error: "Service indisponible.", status: 501 as const };

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Connexion requise.", status: 401 as const };

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return { error: "Session invalide.", status: 401 as const };

  const now = new Date().toISOString();
  const [{ data: annualPass }, { data: courseRows, error: courseError }, { data: completedRows, error: completedError }] = await Promise.all([
    supabase.from("annual_access_passes").select("*").eq("user_id", authData.user.id).eq("status", "active").gt("expires_at", now).order("expires_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("courses").select("id").eq("statut", "publie"),
    supabase.from("module_progress").select("module_id").eq("etudiant_id", authData.user.id).eq("complete", true)
  ]);
  if (courseError) return { error: courseError.message, status: 400 as const };
  if (completedError) return { error: completedError.message, status: 400 as const };

  const courseIds = (courseRows || []).map(row => row.id);
  const { data: moduleRows, error: moduleError } = courseIds.length
    ? await supabase.from("course_modules").select("id").in("course_id", courseIds)
    : { data: [], error: null };
  if (moduleError) return { error: moduleError.message, status: 400 as const };

  const completedIds = new Set((completedRows || []).map(row => row.module_id));
  const modules = moduleRows || [];
  const curriculumCompleted = modules.length > 0 && modules.every(module => completedIds.has(module.id));
  return { annualPass, curriculumCompleted, supabase, userId: authData.user.id };
}

export async function GET(request: Request) {
  const context = await getContext(request);
  if ("error" in context) return NextResponse.json({ ok: false, error: context.error }, { status: context.status });

  const { data: certificate } = await context.supabase
    .from("learning_documents")
    .select("id, document_number, issued_at")
    .eq("user_id", context.userId)
    .eq("document_kind", "final_certificate")
    .maybeSingle();

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
  if ("error" in context) return NextResponse.json({ ok: false, error: context.error }, { status: context.status });
  if (!context.annualPass || !context.curriculumCompleted) {
    return NextResponse.json({ ok: false, error: "Terminez l'ensemble du cursus avant de présenter l'examen final." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const answers = body.answers && typeof body.answers === "object" ? body.answers as Record<string, unknown> : {};
  const correct = FINAL_EXAM_QUESTIONS.filter(question => Number(answers[question.id]) === question.answer).length;
  const score = Math.round((correct / FINAL_EXAM_QUESTIONS.length) * 100);
  const passed = score >= FINAL_EXAM_PASS_SCORE;

  const { error } = await context.supabase.from("final_exam_attempts").insert({
    answers,
    passed,
    score,
    user_id: context.userId
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const certificate = passed
    ? await issueLearningDocument(context.supabase, { documentKind: "final_certificate", userId: context.userId })
    : null;

  return NextResponse.json({ ok: true, certificate, passed, score });
}

