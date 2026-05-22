import { NextResponse } from "next/server";
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

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("etudiant_id", authData.user.id)
    .eq("course_id", body.course_id)
    .maybeSingle();

  if (enrollmentError) {
    return NextResponse.json({ ok: false, error: enrollmentError.message }, { status: 400 });
  }

  if (!enrollment) {
    return NextResponse.json({ ok: false, error: "Ce cours n'est pas disponible sur votre compte." }, { status: 403 });
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
  return NextResponse.json({ ok: true, data });
}
