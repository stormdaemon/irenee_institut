import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import {
  canManageLiveSession,
  closeDailyRoom,
  getDailyApiKey,
  getDailyRoomTimeBounds,
  isAllowedLiveStatusTransition,
  updateDailyRoomTimeBounds
} from "@/lib/live";
import type { LiveSession, LiveSessionStatus } from "@/lib/live";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { hashAuditSubject, recordSecurityEvent } from "@/lib/security-audit";

const MAX_BODY_BYTES = 64 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedStatuses = new Set<LiveSessionStatus>(["scheduled", "live", "ended", "cancelled"]);

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers }
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return json({ ok: false, error: "Séance introuvable." }, 404);
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

  let lookupQuery = auth.supabase
    .from("live_sessions")
    .select("id,titre,description,starts_at,ends_at,course_id,created_by,daily_room_name,daily_room_url,status")
    .eq("id", id);
  if (auth.profile.role === "formateur") {
    lookupQuery = lookupQuery.eq("created_by", auth.user.id);
  }
  const { data: currentData, error: lookupError } = await lookupQuery.maybeSingle();
  if (lookupError) {
    console.error("admin_live_lookup_failed", { sessionId: id, userId: auth.user.id });
    return json({ ok: false, error: "La séance ne peut pas être chargée." }, 503);
  }
  if (!currentData) return json({ ok: false, error: "Séance introuvable." }, 404);

  const current = currentData as LiveSession;
  if (!canManageLiveSession(auth.profile.role, auth.user.id, current)) {
    return json({ ok: false, error: "Séance introuvable." }, 404);
  }
  const update: Record<string, unknown> = {};
  let nextStatus = current.status;
  let startsAt = current.starts_at;
  let endsAt = current.ends_at;
  let scheduleChanged = false;

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !allowedStatuses.has(body.status as LiveSessionStatus)) {
      return json({ ok: false, error: "Statut de séance invalide." }, 400);
    }
    nextStatus = body.status as LiveSessionStatus;
    if (!isAllowedLiveStatusTransition(current.status, nextStatus)) {
      return json({ ok: false, error: "Cette transition de statut n'est pas autorisée." }, 409);
    }
    update.status = nextStatus;
  }

  if (body.titre !== undefined) {
    if (typeof body.titre !== "string" || !body.titre.trim() || body.titre.trim().length > 160) {
      return json({ ok: false, error: "Le titre doit contenir entre 1 et 160 caractères." }, 400);
    }
    update.titre = body.titre.trim();
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.trim().length > 4_000) {
      return json({ ok: false, error: "La description ne peut pas dépasser 4 000 caractères." }, 400);
    }
    update.description = body.description.trim();
  }
  if (body.starts_at !== undefined) {
    if (typeof body.starts_at !== "string" || Number.isNaN(Date.parse(body.starts_at))) {
      return json({ ok: false, error: "La date de début est invalide." }, 400);
    }
    startsAt = new Date(body.starts_at).toISOString();
    update.starts_at = startsAt;
    scheduleChanged = true;
  }
  if (body.ends_at !== undefined) {
    if (body.ends_at === null || body.ends_at === "") {
      endsAt = null;
    } else if (typeof body.ends_at === "string" && !Number.isNaN(Date.parse(body.ends_at))) {
      endsAt = new Date(body.ends_at).toISOString();
    } else {
      return json({ ok: false, error: "La date de fin est invalide." }, 400);
    }
    update.ends_at = endsAt;
    scheduleChanged = true;
  }
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    return json({ ok: false, error: "La fin de séance doit être postérieure au début." }, 400);
  }
  if (scheduleChanged && (current.status === "ended" || current.status === "cancelled")) {
    return json({ ok: false, error: "Une séance terminée ou annulée ne peut pas être replanifiée." }, 409);
  }
  if (Object.keys(update).length === 0) {
    return json({ ok: false, error: "Aucune modification reconnue." }, 400);
  }

  const limit = await checkRateLimit(`admin-live-update:user:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { ok: false, error: "Trop de modifications. Réessayez plus tard." },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) }
    );
  }

  const terminalTransition = current.status !== nextStatus && (nextStatus === "ended" || nextStatus === "cancelled");
  if (current.daily_room_name && (terminalTransition || scheduleChanged)) {
    try {
      const apiKey = await getDailyApiKey(auth.supabase);
      if (!apiKey) return json({ ok: false, error: "La visioconférence n'est pas configurée." }, 503);
      if (terminalTransition) {
        await closeDailyRoom(apiKey, current.daily_room_name, Math.floor(Date.now() / 1000) + 5);
      } else {
        await updateDailyRoomTimeBounds(apiKey, current.daily_room_name, getDailyRoomTimeBounds(startsAt, endsAt));
      }
    } catch (error) {
      console.error("admin_live_daily_update_failed", {
        error: error instanceof Error ? error.name : "unknown",
        sessionId: id,
        userId: auth.user.id
      });
      return json({ ok: false, error: "La salle de visioconférence n'a pas pu être mise à jour." }, 502);
    }
  }

  update.updated_at = new Date().toISOString();
  let updateQuery = auth.supabase
    .from("live_sessions")
    .update(update)
    .eq("id", id);
  if (auth.profile.role === "formateur") {
    updateQuery = updateQuery.eq("created_by", auth.user.id);
  }
  const { data, error } = await updateQuery.select().single();

  if (error) {
    console.error("admin_live_update_failed", { sessionId: id, userId: auth.user.id });
    return json({ ok: false, error: "La séance n'a pas pu être enregistrée." }, 503);
  }
  await recordSecurityEvent({
    actorUserId: auth.user.id,
    eventType: terminalTransition ? "live.session_closed" : "live.session_updated",
    metadata: {
      reason: terminalTransition ? nextStatus : scheduleChanged ? "rescheduled" : "metadata",
      route: "/api/admin/live/[id]",
      subject_hash: hashAuditSubject(id)
    },
    request
  });
  return json({ ok: true, session: data });
}
