import { NextResponse } from "next/server";
import { profiles } from "@/lib/data";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json(profiles);
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json(profiles);
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const { id, role, course_ids, ...profileFields } = await request.json();
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  const profilePayload = Object.fromEntries(
    Object.entries({ ...profileFields, ...(role ? { role } : {}) }).filter(([, value]) => value !== undefined)
  );

  let profile = null;
  if (Object.keys(profilePayload).length) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...profilePayload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: 400 });
    profile = data;
  } else {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: 400 });
    profile = data;
  }

  let enrollments = null;
  if (Array.isArray(course_ids)) {
    const { error: deleteError } = await supabase.from("course_enrollments").delete().eq("etudiant_id", id);
    if (deleteError) return NextResponse.json({ ok: false, verified: false, error: deleteError.message }, { status: 400 });

    if (course_ids.length) {
      const { error: insertError } = await supabase.from("course_enrollments").insert(course_ids.map((course_id: string) => ({
        course_id,
        etudiant_id: id,
        statut: "en_cours",
        progression_globale: 0,
        modules_completes: 0,
        derniere_activite: new Date().toISOString(),
        inscrit_le: new Date().toISOString()
      })));
      if (insertError) return NextResponse.json({ ok: false, verified: false, error: insertError.message }, { status: 400 });
    }

    const { data, error } = await supabase.from("course_enrollments").select("*").eq("etudiant_id", id);
    if (error) return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: 400 });
    if (data.length !== course_ids.length) return NextResponse.json({ ok: false, verified: false, error: "Enrollment verification failed" }, { status: 409 });
    enrollments = data;
  }

  return NextResponse.json({ ok: true, verified: true, profile, enrollments });
}
