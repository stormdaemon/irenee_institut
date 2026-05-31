import { NextResponse } from "next/server";
import { profiles } from "@/lib/data";
import { createServerClient } from "@/lib/supabase";
import { authorizeDirector, authorizeUser } from "@/lib/server-auth";

const selfEditableFields = new Set([
  "civilite",
  "date_naissance",
  "prenom",
  "nom",
  "telephone",
  "adresse",
  "code_postal",
  "ville",
  "pays",
  "marketing_opt_in"
]);

export async function GET(request: Request) {
  const auth = await authorizeDirector(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  if (!supabase) return NextResponse.json(profiles);
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json(profiles);
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const { id, role, course_ids, ...profileFields } = await request.json();
  const auth = await authorizeUser(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  const isDirector = auth.profile.role === "directeur";
  if (!isDirector && id !== auth.user.id) {
    return NextResponse.json({ ok: false, error: "Vous ne pouvez modifier que votre propre profil." }, { status: 403 });
  }
  if (!isDirector && (role !== undefined || course_ids !== undefined)) {
    return NextResponse.json({ ok: false, error: "Ces champs sont reserves a la direction." }, { status: 403 });
  }

  const profilePayload = Object.fromEntries(
    Object.entries({ ...profileFields, ...(isDirector && role ? { role } : {}) })
      .filter(([key, value]) => value !== undefined && (isDirector || selfEditableFields.has(key)))
  );
  if (profilePayload.marketing_opt_in !== undefined) {
    const marketingOptIn = profilePayload.marketing_opt_in === true;
    profilePayload.marketing_opt_in = marketingOptIn;
    profilePayload.marketing_opt_in_at = marketingOptIn ? new Date().toISOString() : null;
    profilePayload.marketing_opt_out_at = marketingOptIn ? null : new Date().toISOString();
  }

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
  if (isDirector && Array.isArray(course_ids)) {
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
