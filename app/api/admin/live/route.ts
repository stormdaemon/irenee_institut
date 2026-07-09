import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import {
  canManageCourseLiveSessions,
  closeDailyRoom,
  createDailyRoom,
  getDailyApiKey,
  getDailyRoomTimeBounds,
  slugifyRoomName
} from "@/lib/live";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { hashAuditSubject, recordSecurityEvent } from "@/lib/security-audit";

const MAX_BODY_BYTES = 64 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers }
  });
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  let sessionsQuery = auth.supabase
    .from("live_sessions")
    .select("*")
    .order("starts_at", { ascending: false });
  if (auth.profile.role === "formateur") {
    sessionsQuery = sessionsQuery.eq("created_by", auth.user.id);
  }
  const { data, error } = await sessionsQuery;

  if (error) {
    console.error("admin_live_list_failed", { userId: auth.user.id });
    return json({ ok: false, error: "Les séances ne peuvent pas être chargées." }, 503);
  }
  return json({ ok: true, sessions: data || [] });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    const parsed = await readJsonBodyWithLimit(request, MAX_BODY_BYTES);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_body");
    body = parsed as Record<string, unknown>;
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    const message = status === 413 ? "La requête est trop volumineuse."
      : status === 415 ? "Le format de la requête n'est pas accepté."
        : "La requête est invalide.";
    return json({ ok: false, error: message }, status);
  }
  const titre = String(body.titre || "").trim();
  const startsAtRaw = String(body.starts_at || "").trim();

  if (!titre || titre.length > 160) {
    return json({ ok: false, error: "Le titre doit contenir entre 1 et 160 caractères." }, 400);
  }
  if (!startsAtRaw || Number.isNaN(Date.parse(startsAtRaw))) {
    return json({ ok: false, error: "La date de début est invalide." }, 400);
  }

  const description = String(body.description || "").trim();
  if (description.length > 4_000) {
    return json({ ok: false, error: "La description ne peut pas dépasser 4 000 caractères." }, 400);
  }
  const startsAt = new Date(startsAtRaw).toISOString();
  let endsAt: string | null = null;
  if (body.ends_at !== undefined && body.ends_at !== null && String(body.ends_at).trim()) {
    const endsAtRaw = String(body.ends_at);
    if (Number.isNaN(Date.parse(endsAtRaw))) return json({ ok: false, error: "La date de fin est invalide." }, 400);
    endsAt = new Date(endsAtRaw).toISOString();
  }
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    return json({ ok: false, error: "La fin de séance doit être postérieure au début." }, 400);
  }
  const courseId = body.course_id ? String(body.course_id) : null;
  if (courseId && !UUID_PATTERN.test(courseId)) {
    return json({ ok: false, error: "Le cours associé est invalide." }, 400);
  }

  // Resolve and authorize the course before any external Daily side effect.
  if (courseId) {
    const { data: course, error: courseError } = await auth.supabase
      .from("courses")
      .select("id,auteur_id")
      .eq("id", courseId)
      .maybeSingle();
    if (courseError) {
      console.error("admin_live_course_lookup_failed", { userId: auth.user.id });
      return json({ ok: false, error: "Le cours associé ne peut pas être vérifié." }, 503);
    }
    if (!course) return json({ ok: false, error: "Cours associé introuvable." }, 404);
    if (!canManageCourseLiveSessions(auth.profile.role, auth.user.id, course)) {
      await recordSecurityEvent({
        actorUserId: auth.user.id,
        eventType: "live.session.course_denied",
        metadata: {
          reason: "course_ownership",
          route: "/api/admin/live",
          subject_hash: hashAuditSubject(courseId)
        },
        request
      });
      return json({ ok: false, error: "Vous ne pouvez planifier que vos propres cours." }, 403);
    }
  }

  const limit = await checkRateLimit(`admin-live:user:${auth.user.id}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { ok: false, error: "Trop de créations de séances. Réessayez plus tard." },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) }
    );
  }

  // Create the Daily room server-side using the key stored in system_settings.
  let dailyRoom: { name: string; url: string };
  try {
    const apiKey = await getDailyApiKey(auth.supabase);
    if (!apiKey) {
      return json({ ok: false, error: "La visioconférence n'est pas configurée." }, 503);
    }
    const bounds = getDailyRoomTimeBounds(startsAt, endsAt);
    const roomName = `${slugifyRoomName(titre)}-${randomBytes(6).toString("hex")}`;
    dailyRoom = await createDailyRoom(apiKey, { name: roomName, ...bounds });
  } catch (error) {
    console.error("admin_live_daily_create_failed", {
      error: error instanceof Error ? error.name : "unknown",
      userId: auth.user.id
    });
    return json({ ok: false, error: "La salle de visioconférence n'a pas pu être créée." }, 502);
  }

  const { data, error } = await auth.supabase
    .from("live_sessions")
    .insert({
      titre,
      description,
      starts_at: startsAt,
      ends_at: endsAt,
      course_id: courseId,
      created_by: auth.user.id,
      daily_room_name: dailyRoom.name,
      daily_room_url: dailyRoom.url,
      status: "scheduled"
    })
    .select()
    .single();

  if (error) {
    console.error("admin_live_persist_failed", { roomName: dailyRoom.name, userId: auth.user.id });
    try {
      const apiKey = await getDailyApiKey(auth.supabase);
      if (apiKey) await closeDailyRoom(apiKey, dailyRoom.name, Math.floor(Date.now() / 1000) + 5);
    } catch {
      await recordSecurityEvent({
        actorUserId: auth.user.id,
        eventType: "live.session.orphan_cleanup_failed",
        metadata: {
          route: "/api/admin/live",
          subject_hash: hashAuditSubject(dailyRoom.name)
        },
        request
      });
    }
    return json({ ok: false, error: "La séance n'a pas pu être enregistrée." }, 503);
  }
  await recordSecurityEvent({
    actorUserId: auth.user.id,
    eventType: "live.session_created",
    metadata: {
      route: "/api/admin/live",
      subject_hash: hashAuditSubject(String(data.id))
    },
    request
  });
  return json({ ok: true, session: data });
}
