import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRequest } from "@/lib/api-auth";
import { ProfileAdministrationError, replaceManualCourseEnrollments } from "@/lib/profile-admin";
import { parseProfileUpdate, ProfileInputError } from "@/lib/profile-input";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { recordSecurityEvent } from "@/lib/security-audit";
import type { Role } from "@/lib/types";

const roles = new Set<Role>(["etudiant", "formateur", "directeur"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 64 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const id = String(body.id || "").trim();
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ ok: false, error: "Identifiant utilisateur invalide." }, { status: 400 });

  const { data: actor, error: actorError } = await auth.supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (actorError) return NextResponse.json({ ok: false, error: "L'autorisation n'a pas pu être vérifiée." }, { status: 500 });

  const isDirector = actor?.role === "directeur";
  if (id !== auth.user.id && !isDirector) {
    return NextResponse.json({ ok: false, error: "Acces refuse." }, { status: 403 });
  }

  const changesRole = body.role !== undefined;
  const changesCourses = body.course_ids !== undefined;
  if (changesRole && changesCourses) {
    return NextResponse.json({ ok: false, error: "Modifiez le rôle et les cours séparément." }, { status: 400 });
  }

  let profilePayload: Record<string, unknown>;
  try {
    profilePayload = parseProfileUpdate(
      Object.fromEntries(Object.entries(body).filter(([key]) => !["id", "role", "course_ids"].includes(key))),
      isDirector
    );
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "Les informations de profil sont invalides." }, { status: 400 });
  }

  if (changesRole) {
    if (!isDirector || !roles.has(body.role as Role)) {
      return NextResponse.json({ ok: false, error: "Rôle invalide ou non autorisé." }, { status: 403 });
    }
    if (id === auth.user.id && body.role !== "directeur") {
      return NextResponse.json({ ok: false, error: "Vous ne pouvez pas retirer votre propre rôle de direction." }, { status: 409 });
    }
    profilePayload.role = body.role;
  }

  let profile: Record<string, unknown> | null = null;
  if (Object.keys(profilePayload).length) {
    const { data, error } = await auth.supabase
      .from("profiles")
      .update({ ...profilePayload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ ok: false, verified: false, error: "Le profil n'a pas pu être enregistré." }, { status: 400 });
    profile = data;
    if (changesRole) {
      await recordSecurityEvent({
        actorUserId: auth.user.id,
        eventType: "admin.profile.role_changed",
        metadata: { subject_hash: id },
        request
      });
    }
  } else {
    const { data, error } = await auth.supabase.from("profiles").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ ok: false, verified: false, error: "Le profil est introuvable." }, { status: 404 });
    profile = data;
  }

  let enrollments = null;
  if (changesCourses) {
    if (!isDirector) return NextResponse.json({ ok: false, error: "Acces refuse." }, { status: 403 });
    if (!Array.isArray(body.course_ids)) return NextResponse.json({ ok: false, error: "La liste de cours est invalide." }, { status: 400 });
    try {
      enrollments = await replaceManualCourseEnrollments(id, body.course_ids);
      await recordSecurityEvent({ actorUserId: auth.user.id, eventType: "admin.profile.courses_changed", request });
    } catch (error) {
      if (error instanceof ProfileAdministrationError) {
        return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: error.status });
      }
      console.error("profile_course_assignment_failed", { actorUserId: auth.user.id });
      return NextResponse.json({ ok: false, verified: false, error: "Les cours n'ont pas pu être attribués." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, verified: true, profile, enrollments });
}
