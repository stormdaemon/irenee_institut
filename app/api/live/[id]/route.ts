import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import {
  buildDailyMeetingUrl,
  canManageLiveSession,
  canAccessSession,
  createDailyMeetingToken,
  ensureDailyRoomPrivate,
  getDailyApiKey,
  getLiveJoinDecision,
  getStudentLiveContext
} from "@/lib/live";
import type { LiveSession } from "@/lib/live";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security-audit";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer"
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...SENSITIVE_HEADERS, ...headers }
  });
}

// Token issuance changes external state and is deliberately a POST: cookie
// authentication then receives the same-origin/CSRF validation in api-auth.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return json({ ok: false, error: "Séance introuvable." }, 404);

  const [{ data: profile, error: profileError }, { data, error }] = await Promise.all([
    auth.supabase
      .from("profiles")
      .select("role,prenom,nom")
      .eq("id", auth.user.id)
      .maybeSingle(),
    auth.supabase
      .from("live_sessions")
      .select("id,titre,description,starts_at,ends_at,course_id,created_by,daily_room_name,daily_room_url,status")
      .eq("id", id)
      .maybeSingle()
  ]);

  if (profileError || error) {
    console.error("live_join_lookup_failed", { sessionId: id, userId: auth.user.id });
    return json({ ok: false, error: "La séance ne peut pas être chargée pour le moment." }, 503);
  }
  if (!data) return json({ ok: false, error: "Séance introuvable." }, 404);

  const session = data as LiveSession;
  const role = typeof profile?.role === "string" ? profile.role : "etudiant";
  if (role === "formateur" && !canManageLiveSession(role, auth.user.id, session)) {
    return json({ ok: false, error: "Séance introuvable." }, 404);
  }
  const ctx = await getStudentLiveContext(auth.supabase, auth.user.id, role);
  if (!ctx.verified) {
    console.error("live_join_access_lookup_failed", { sessionId: id, userId: auth.user.id });
    return json({ ok: false, error: "Votre accès à la séance ne peut pas être vérifié." }, 503);
  }
  if (!canAccessSession(ctx, session)) {
    return json({ ok: false, error: "Vous n'avez pas accès à cette séance." }, 403);
  }

  const join = getLiveJoinDecision(session);
  if (!join.allowed) {
    if (join.reason === "too_early") {
      return json(
        { ok: false, error: "La salle n'ouvre que le jour de la séance." },
        425,
        { "Retry-After": String(join.retryAfterSeconds) }
      );
    }
    return json({ ok: false, error: "Cette séance n'est plus accessible." }, join.reason === "ended" ? 410 : 503);
  }

  if (!session.daily_room_name || !session.daily_room_url) {
    return json({ ok: false, error: "La salle de cette séance n'est pas encore prête." }, 409);
  }

  const limit = await checkRateLimit(`live-token:user:${auth.user.id}:session:${session.id}`, 10, 5 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { ok: false, error: "Trop de tentatives de connexion. Réessayez dans quelques instants." },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) }
    );
  }

  try {
    const apiKey = await getDailyApiKey(auth.supabase);
    if (!apiKey) return json({ ok: false, error: "La visioconférence est momentanément indisponible." }, 503);

    // This upgrades legacy public rooms before access is minted. New rooms are
    // already private, but repeating this idempotent operation fails closed if
    // the provider configuration ever drifts.
    await ensureDailyRoomPrivate(apiKey, session.daily_room_name);
    const userName = `${String(profile?.prenom || "")} ${String(profile?.nom || "")}`.trim() || "Participant";
    const token = await createDailyMeetingToken(apiKey, {
      roomName: session.daily_room_name,
      userId: auth.user.id,
      userName,
      isOwner: ctx.staff,
      expiresAt: join.expiresAt
    });
    const roomUrl = buildDailyMeetingUrl(session.daily_room_url, session.daily_room_name, token);
    await recordSecurityEvent({
      actorUserId: auth.user.id,
      eventType: "live.token_issued",
      metadata: { route: "/api/live/[id]" },
      request
    });

    return json({
      ok: true,
      session: {
        id: session.id,
        titre: session.titre,
        description: session.description,
        starts_at: session.starts_at,
        ends_at: session.ends_at,
        status: session.status,
        room_url: roomUrl
      }
    });
  } catch (error) {
    console.error("live_join_token_failed", {
      error: error instanceof Error ? error.name : "unknown",
      sessionId: session.id,
      userId: auth.user.id
    });
    return json({ ok: false, error: "La visioconférence est momentanément indisponible." }, 502);
  }
}
