import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRequest } from "@/lib/api-auth";
import type { Role } from "@/lib/types";

const profileFields = [
  "adresse",
  "bio",
  "bio_description",
  "civilite",
  "code_postal",
  "date_naissance",
  "formation_academique",
  "instagram_url",
  "linkedin_url",
  "nom",
  "pays",
  "prenom",
  "profession",
  "realisations",
  "specialites",
  "telephone",
  "tiktok_url",
  "twitter_url",
  "ville"
] as const;

const registrationFields = [
  "formation_choisie",
  "modalite_paiement",
  "moyen_paiement",
  "statut_inscription",
  "tarif_applicable"
] as const;

const roles = new Set<Role>(["etudiant", "formateur", "directeur"]);

function pick(body: Record<string, unknown>, keys: readonly string[]) {
  return Object.fromEntries(keys.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  const { data: actor, error: actorError } = await auth.supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (actorError) return NextResponse.json({ ok: false, error: actorError.message }, { status: 400 });

  const isDirector = actor?.role === "directeur";
  if (id !== auth.user.id && !isDirector) {
    return NextResponse.json({ ok: false, error: "Acces refuse." }, { status: 403 });
  }

  const profilePayload: Record<string, unknown> = pick(body, isDirector ? [...profileFields, ...registrationFields] : profileFields);
  if (body.role !== undefined) {
    if (!isDirector || !roles.has(body.role as Role)) {
      return NextResponse.json({ ok: false, error: "Role invalide ou non autorise." }, { status: 403 });
    }
    profilePayload.role = body.role;
  }

  let profile = null;
  if (Object.keys(profilePayload).length) {
    const { data, error } = await auth.supabase
      .from("profiles")
      .update({ ...profilePayload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: 400 });
    profile = data;
  } else {
    const { data, error } = await auth.supabase.from("profiles").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: 400 });
    profile = data;
  }

  let enrollments = null;
  if (Array.isArray(body.course_ids)) {
    if (!isDirector) return NextResponse.json({ ok: false, error: "Acces refuse." }, { status: 403 });

    const courseIds = [...new Set(body.course_ids.map(String).filter(Boolean))];
    const { error: deleteError } = await auth.supabase.from("course_enrollments").delete().eq("etudiant_id", id);
    if (deleteError) return NextResponse.json({ ok: false, verified: false, error: deleteError.message }, { status: 400 });

    if (courseIds.length) {
      const { error: insertError } = await auth.supabase.from("course_enrollments").insert(courseIds.map(course_id => ({
        course_id,
        etudiant_id: id,
        statut: "en_cours"
      })));
      if (insertError) return NextResponse.json({ ok: false, verified: false, error: insertError.message }, { status: 400 });
    }

    const { data, error } = await auth.supabase.from("course_enrollments").select("*").eq("etudiant_id", id);
    if (error) return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: 400 });
    const enrollmentRows = data || [];
    if (enrollmentRows.length !== courseIds.length) return NextResponse.json({ ok: false, verified: false, error: "Enrollment verification failed" }, { status: 409 });
    enrollments = enrollmentRows;
  }

  return NextResponse.json({ ok: true, verified: true, profile, enrollments });
}
