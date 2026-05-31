import { NextResponse } from "next/server";
import { issueLearningDocument } from "@/lib/education";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json();
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Connectez-vous pour enregistrer votre avancée." }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: authError?.message || "Session invalide ou expirée." }, { status: 401 });
  }

  if (!body.course_id || !body.module_id) {
    return NextResponse.json({ ok: false, error: "course_id et module_id sont requis." }, { status: 400 });
  }

  const { data: moduleRow, error: moduleError } = await supabase
    .from("course_modules")
    .select("id, titre, course_id, courses(titre)")
    .eq("id", body.module_id)
    .eq("course_id", body.course_id)
    .maybeSingle();
  if (moduleError) return NextResponse.json({ ok: false, error: moduleError.message }, { status: 400 });
  if (!moduleRow) return NextResponse.json({ ok: false, error: "Module introuvable pour ce cours." }, { status: 404 });

  let { data: enrollment, error: enrollmentError } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("etudiant_id", authData.user.id)
    .eq("course_id", body.course_id)
    .maybeSingle();

  if (enrollmentError) {
    return NextResponse.json({ ok: false, error: enrollmentError.message }, { status: 400 });
  }

  if (!enrollment) {
    const { data: annualPass, error: annualPassError } = await supabase
      .from("annual_access_passes")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (annualPassError) return NextResponse.json({ ok: false, error: annualPassError.message }, { status: 400 });
    if (!annualPass) return NextResponse.json({ ok: false, error: "Ce cours n'est pas disponible sur votre compte." }, { status: 403 });

    const { data: createdEnrollment, error: createEnrollmentError } = await supabase
      .from("course_enrollments")
      .upsert({ course_id: body.course_id, etudiant_id: authData.user.id, statut: "en_cours" }, { onConflict: "course_id,etudiant_id" })
      .select("id")
      .single();
    if (createEnrollmentError) return NextResponse.json({ ok: false, error: createEnrollmentError.message }, { status: 400 });
    enrollment = createdEnrollment;
  }

  const payload = {
    enrollment_id: enrollment.id,
    etudiant_id: authData.user.id,
    course_id: body.course_id,
    module_id: body.module_id,
    statut: body.statut || (body.complete ? "termine" : "en_cours"),
    progression: Number(body.progression ?? (body.complete ? 100 : 0)),
    complete: Boolean(body.complete),
    score_quiz: body.score_quiz ?? null,
    date_completion: body.complete ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("module_progress")
    .upsert(payload, { onConflict: "etudiant_id,module_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const documents = [];
  const warnings = [];
  if (body.complete) {
    const courseRelation = Array.isArray(moduleRow.courses) ? moduleRow.courses[0] : moduleRow.courses;
    const courseTitle = String(courseRelation?.titre || "Cours d'apologétique");
    try {
      documents.push(await issueLearningDocument(supabase, {
        courseId: body.course_id,
        courseTitle,
        documentKind: "module_parchment",
        moduleId: body.module_id,
        moduleTitle: moduleRow.titre,
        userId: authData.user.id
      }));

      const [{ count: totalModules }, { count: completedModules }] = await Promise.all([
        supabase.from("course_modules").select("*", { count: "exact", head: true }).eq("course_id", body.course_id),
        supabase.from("module_progress").select("*", { count: "exact", head: true }).eq("course_id", body.course_id).eq("etudiant_id", authData.user.id).eq("complete", true)
      ]);

      if (Number(totalModules || 0) > 0 && Number(completedModules || 0) >= Number(totalModules || 0)) {
        documents.push(await issueLearningDocument(supabase, {
          courseId: body.course_id,
          courseTitle,
          documentKind: "course_parchment",
          userId: authData.user.id
        }));
      }
    } catch (documentError) {
      warnings.push(documentError instanceof Error ? documentError.message : "Le parchemin n'a pas pu être préparé.");
    }
  }

  return NextResponse.json({ ok: true, data, documents, warnings });
}
