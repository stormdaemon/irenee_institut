import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { issueLearningDocument } from "@/lib/education";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import {
  evaluateModuleCompletionGate,
  evaluateModuleQuizAnswers,
  hasPublishedCourseAccess,
  isActiveCourseEnrollment,
  parseModuleCompletion,
  parseModuleStart
} from "@/lib/learning-security";

function invalidRequest(error: unknown) {
  return NextResponse.json({
    ok: false,
    error: error instanceof Error ? error.message : "Requête de progression invalide."
  }, { status: 400 });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const limit = await checkRateLimit(`module-progress:user:${auth.user.id}`, 180, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Trop de mises à jour de progression." }, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
      status: 429
    });
  }

  let command: ReturnType<typeof parseModuleCompletion>;
  let isStart = false;
  let requestBody: Record<string, unknown> = {};
  try {
    requestBody = await readJsonBodyWithLimit<Record<string, unknown>>(request, 8192);
    isStart = requestBody.action === "start";
    command = isStart ? parseModuleStart(requestBody) : parseModuleCompletion(requestBody);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return invalidRequest(error);
  }

  const { courseId, moduleId } = command;
  const now = new Date().toISOString();
  const [profileResult, courseResult, moduleResult, enrollmentResult, annualPassResult] = await Promise.all([
    auth.supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
    auth.supabase.from("courses").select("id,titre,statut").eq("id", courseId).eq("statut", "publie").maybeSingle(),
    auth.supabase
      .from("course_modules")
      .select("id,titre,course_id,type_contenu,ordre,quiz")
      .eq("id", moduleId)
      .eq("course_id", courseId)
      .maybeSingle(),
    auth.supabase
      .from("course_enrollments")
      .select("id,statut,access_source,access_expires_at")
      .eq("etudiant_id", auth.user.id)
      .eq("course_id", courseId)
      .eq("statut", "en_cours")
      .maybeSingle(),
    auth.supabase
      .from("annual_access_passes")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .gt("expires_at", now)
      .limit(1)
      .maybeSingle()
  ]);

  const accessError = profileResult.error || courseResult.error || moduleResult.error || enrollmentResult.error || annualPassResult.error;
  if (accessError) {
    return NextResponse.json({ ok: false, error: "Impossible de vérifier l'accès à ce module." }, { status: 500 });
  }
  if (!courseResult.data || !moduleResult.data) {
    return NextResponse.json({ ok: false, error: "Module introuvable pour ce cours." }, { status: 404 });
  }
  const role = String(profileResult.data?.role || "etudiant");
  const isStaff = role === "directeur" || role === "formateur";
  const activeAnnualPass = Boolean(annualPassResult.data);
  const activeEnrollment = Boolean(enrollmentResult.data) && isActiveCourseEnrollment({
    accessExpiresAt: enrollmentResult.data?.access_expires_at,
    accessSource: enrollmentResult.data?.access_source,
    activeAnnualPass,
    status: enrollmentResult.data?.statut
  });
  const hasAccess = hasPublishedCourseAccess({
    activeAnnualPass,
    activeEnrollment,
    isStaff,
    published: courseResult.data.statut === "publie"
  });
  if (!hasAccess) {
    return NextResponse.json({ ok: false, error: "Ce cours n'est pas disponible sur votre compte." }, { status: 403 });
  }
  if (isStaff) {
    return NextResponse.json({
      accessMode: "preview",
      error: "La prévisualisation ne modifie pas la progression.",
      ok: false
    }, {
      headers: { "Cache-Control": "private, no-store" },
      status: 403
    });
  }

  const [courseModulesResult, progressRowsResult] = await Promise.all([
    auth.supabase.from("course_modules").select("id,ordre").eq("course_id", courseId).order("ordre", { ascending: true }),
    auth.supabase
      .from("module_progress")
      .select("id,module_id,complete,date_debut,progression,statut")
      .eq("course_id", courseId)
      .eq("etudiant_id", auth.user.id)
  ]);
  if (courseModulesResult.error || progressRowsResult.error) {
    return NextResponse.json({ ok: false, error: "La progression est momentanément indisponible." }, { status: 500 });
  }
  const orderedModuleIds = (courseModulesResult.data || []).map(item => String(item.id));
  const progressRows = progressRowsResult.data || [];
  const completedModuleIds = progressRows.filter(item => item.complete).map(item => String(item.module_id));
  const currentProgress = progressRows.find(item => item.module_id === moduleId);
  const currentIndex = orderedModuleIds.indexOf(moduleId);
  if (currentIndex < 0) {
    return NextResponse.json({ ok: false, error: "Module introuvable pour ce cours." }, { status: 404 });
  }
  if (orderedModuleIds.slice(0, currentIndex).some(id => !completedModuleIds.includes(id))) {
    return NextResponse.json({ ok: false, error: "Terminez les modules précédents dans l'ordre du cours." }, { status: 409 });
  }

  if (isStart) {
    if (currentProgress) {
      if (currentProgress.complete !== true && !currentProgress.date_debut) {
        const { data: repairedStart, error: repairError } = await auth.supabase
          .from("module_progress")
          .update({ date_debut: now, statut: "en_cours", updated_at: now })
          .eq("id", currentProgress.id)
          .eq("etudiant_id", auth.user.id)
          .eq("module_id", moduleId)
          .eq("complete", false)
          .select("id,module_id,complete,date_debut,progression,statut")
          .single();
        if (repairError || !repairedStart) {
          return NextResponse.json({ ok: false, error: "Le début de lecture n'a pas pu être réinitialisé." }, { status: 500 });
        }
        return NextResponse.json({ ok: true, data: repairedStart }, { headers: { "Cache-Control": "private, no-store" } });
      }
      return NextResponse.json({ ok: true, data: currentProgress }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const startPayload = {
      complete: false,
      course_id: courseId,
      date_debut: now,
      enrollment_id: activeEnrollment ? enrollmentResult.data?.id || null : null,
      etudiant_id: auth.user.id,
      module_id: moduleId,
      progression: 0,
      score_quiz: null,
      statut: "en_cours",
      updated_at: now
    };
    const { data: started, error: startError } = await auth.supabase
      .from("module_progress")
      .insert(startPayload)
      .select()
      .single();
    if (startError) {
      // A concurrent tab may have inserted the unique user/module row first.
      const { data: concurrent } = await auth.supabase
        .from("module_progress")
        .select("id,module_id,complete,date_debut,progression,statut")
        .eq("etudiant_id", auth.user.id)
        .eq("module_id", moduleId)
        .maybeSingle();
      if (concurrent) return NextResponse.json({ ok: true, data: concurrent }, { headers: { "Cache-Control": "private, no-store" } });
      return NextResponse.json({ ok: false, error: "Le début de lecture n'a pas pu être enregistré." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: started }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const completionGate = evaluateModuleCompletionGate({
    alreadyComplete: Boolean(currentProgress?.complete),
    completedModuleIds,
    moduleId,
    orderedModuleIds,
    startedAt: currentProgress?.date_debut
  });
  if (!completionGate.allowed) {
    const waiting = completionGate.reason === "engagement_time";
    return NextResponse.json({
      ok: false,
      error: waiting
        ? "Prenez encore un moment pour parcourir ce module avant de le terminer."
        : "Ouvrez d'abord ce module pour commencer votre progression."
    }, {
      headers: waiting ? { "Retry-After": String(completionGate.retryAfterSeconds) } : undefined,
      status: 409
    });
  }

  if (!currentProgress?.id) {
    return NextResponse.json({ ok: false, error: "La session de progression est introuvable." }, { status: 409 });
  }

  if (currentProgress?.complete) {
    return NextResponse.json({ ok: true, data: currentProgress, documents: [], warnings: [] }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  }

  let quizScore: number | null = null;
  if (moduleResult.data.type_contenu === "quiz") {
    let quizResult: ReturnType<typeof evaluateModuleQuizAnswers>;
    try {
      quizResult = evaluateModuleQuizAnswers(requestBody.answers, moduleResult.data.quiz);
    } catch (error) {
      return invalidRequest(error);
    }
    quizScore = quizResult.score;
    if (!quizResult.passed) {
      await auth.supabase
        .from("module_progress")
        .update({ score_quiz: quizScore, updated_at: now })
        .eq("id", currentProgress?.id);
      return NextResponse.json({
        ok: false,
        error: `Score ${quizScore} %. Il faut obtenir au moins 80 % pour valider ce quiz.`,
        passed: false,
        score: quizScore
      }, { status: 422 });
    }
  } else if (requestBody.answers !== undefined) {
    return NextResponse.json({ ok: false, error: "Ce module n'accepte pas de réponses de quiz." }, { status: 400 });
  }

  const payload = {
    complete: true,
    course_id: courseId,
    date_completion: now,
    enrollment_id: activeEnrollment ? enrollmentResult.data?.id || null : null,
    etudiant_id: auth.user.id,
    module_id: moduleId,
    progression: 100,
    score_quiz: quizScore,
    statut: "termine",
    updated_at: now
  };

  const { data, error } = await auth.supabase
    .from("module_progress")
    .update(payload)
    .eq("id", currentProgress?.id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: "Votre progression n'a pas pu être enregistrée." }, { status: 500 });
  }

  const documents = [];
  const warnings = [];
  // The early preview return above is the primary guard. Keep document
  // issuance independently scoped to students as defense in depth.
  if (!isStaff) {
    try {
      documents.push(await issueLearningDocument(auth.supabase, {
        courseId,
        courseTitle: String(courseResult.data.titre || "Cours d'apologétique"),
        documentKind: "module_parchment",
        moduleId,
        moduleTitle: String(moduleResult.data.titre || "Module d'apologétique"),
        userId: auth.user.id
      }));

      const courseModuleIds = orderedModuleIds;
      const completedIds = new Set([...completedModuleIds, moduleId]);
      if (courseModuleIds.length > 0 && courseModuleIds.every(id => completedIds.has(id))) {
        documents.push(await issueLearningDocument(auth.supabase, {
          courseId,
          courseTitle: String(courseResult.data.titre || "Cours d'apologétique"),
          documentKind: "course_parchment",
          userId: auth.user.id
        }));
      }
    } catch (documentError) {
      warnings.push(documentError instanceof Error ? documentError.message : "Le parchemin n'a pas pu être préparé.");
    }
  }

  return NextResponse.json({ ok: true, data, documents, warnings });
}
