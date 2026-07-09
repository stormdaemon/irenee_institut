import type { createServerClient } from "@/lib/supabase";
import { getSystemSettings } from "@/lib/settings";
import { isActiveCourseEnrollment } from "@/lib/learning-security";

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>;

const DAILY_API = "https://api.daily.co/v1";
const DAILY_REQUEST_TIMEOUT_MS = 10_000;
const DAILY_RESPONSE_MAX_CHARS = 128 * 1024;
const DAILY_ROOM_NAME_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DAILY_USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,36}$/;
const DAILY_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const JOIN_TOKEN_TTL_SECONDS = 5 * 60;
const STUDENT_EARLY_JOIN_MS = 15 * 60 * 1000;
const STAFF_EARLY_JOIN_MS = 60 * 60 * 1000;
const DEFAULT_SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
const ROOM_END_GRACE_MS = 15 * 60 * 1000;

export type LiveSessionStatus = "scheduled" | "live" | "ended" | "cancelled";

export type LiveSession = {
  id: string;
  titre: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  course_id: string | null;
  created_by: string | null;
  daily_room_name: string | null;
  daily_room_url: string | null;
  status: LiveSessionStatus;
  created_at?: string;
  updated_at?: string;
};

// Public-facing shape: never leaks the Daily room URL in list endpoints.
export type PublicLiveSession = Omit<LiveSession, "created_by" | "daily_room_name" | "daily_room_url" | "created_at" | "updated_at"> & {
  has_room: boolean;
};

export function toPublicSession(session: LiveSession): PublicLiveSession {
  return {
    id: session.id,
    titre: session.titre,
    description: session.description,
    starts_at: session.starts_at,
    ends_at: session.ends_at,
    course_id: session.course_id,
    status: session.status,
    has_room: Boolean(session.daily_room_url)
  };
}

export function canManageLiveSession(
  role: string,
  userId: string,
  session: Pick<LiveSession, "created_by">
) {
  return role === "directeur" || (role === "formateur" && Boolean(userId) && session.created_by === userId);
}

export function canManageCourseLiveSessions(
  role: string,
  userId: string,
  course: { auteur_id?: string | null }
) {
  return role === "directeur" || (role === "formateur" && Boolean(userId) && course.auteur_id === userId);
}

// The Daily API key lives only in public.system_settings (key='dailyApiKey') and
// is read exclusively server-side. It must never be exposed to the client.
export async function getDailyApiKey(supabase: ServerClient): Promise<string> {
  const settings = await getSystemSettings(supabase);
  return String(settings.dailyApiKey || "").trim();
}

export function slugifyRoomName(titre: string) {
  const base = titre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base || "seance";
}

export class DailyApiError extends Error {
  constructor(message = "Le service de visioconférence est momentanément indisponible.") {
    super(message);
    this.name = "DailyApiError";
  }
}

function assertDailyApiKey(apiKey: string) {
  if (!apiKey || apiKey.length > 4096 || /[\u0000-\u001f\u007f]/.test(apiKey)) {
    throw new DailyApiError("La configuration Daily est invalide.");
  }
}

function assertDailyRoomName(roomName: string) {
  if (!DAILY_ROOM_NAME_PATTERN.test(roomName)) {
    throw new DailyApiError("Le nom de salle Daily est invalide.");
  }
}

async function dailyJsonRequest(
  apiKey: string,
  path: string,
  body: unknown,
  fetcher: typeof fetch
) {
  assertDailyApiKey(apiKey);
  let response: Response;
  try {
    response = await fetcher(`${DAILY_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(DAILY_REQUEST_TIMEOUT_MS)
    });
  } catch {
    throw new DailyApiError();
  }

  const raw = await response.text().catch(() => "");
  if (raw.length > DAILY_RESPONSE_MAX_CHARS) throw new DailyApiError();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    throw new DailyApiError();
  }
  if (!response.ok) throw new DailyApiError();
  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function buildDailyMeetingUrl(roomUrl: string, roomName: string, token: string) {
  assertDailyRoomName(roomName);
  if (!DAILY_TOKEN_PATTERN.test(token)) throw new DailyApiError("Le jeton Daily est invalide.");

  let parsed: URL;
  try {
    parsed = new URL(roomUrl);
  } catch {
    throw new DailyApiError("L'URL de salle Daily est invalide.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !parsed.hostname.endsWith(".daily.co") ||
    parsed.hostname === "daily.co" ||
    parsed.pathname.replace(/\/$/, "") !== `/${roomName}`
  ) {
    throw new DailyApiError("L'URL de salle Daily est invalide.");
  }

  parsed.search = "";
  parsed.hash = "";
  parsed.searchParams.set("t", token);
  return parsed.toString();
}

export function getDailyRoomTimeBounds(startsAtIso: string, endsAtIso: string | null) {
  const startsAt = Date.parse(startsAtIso);
  const endsAt = endsAtIso ? Date.parse(endsAtIso) : startsAt + DEFAULT_SESSION_DURATION_MS;
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    throw new DailyApiError("L'horaire de séance Daily est invalide.");
  }
  return {
    nbf: Math.floor((startsAt - STAFF_EARLY_JOIN_MS) / 1000),
    exp: Math.floor((endsAt + ROOM_END_GRACE_MS) / 1000)
  };
}

export async function createDailyRoom(
  apiKey: string,
  options: { name: string; nbf: number; exp: number },
  fetcher: typeof fetch = fetch
) {
  assertDailyRoomName(options.name);
  if (!Number.isInteger(options.nbf) || !Number.isInteger(options.exp) || options.nbf <= 0 || options.exp <= options.nbf) {
    throw new DailyApiError("La fenêtre temporelle Daily est invalide.");
  }
  const data = await dailyJsonRequest(apiKey, "/rooms", {
    name: options.name,
    privacy: "private",
    properties: {
      nbf: options.nbf,
      exp: options.exp,
      eject_at_room_exp: true,
      enable_prejoin_ui: true,
      enable_knocking: false,
      enable_chat: true,
      enable_screenshare: true,
      enforce_unique_user_ids: true,
      lang: "fr"
    }
  }, fetcher);

  if (!isRecord(data) || data.name !== options.name || typeof data.url !== "string") {
    throw new DailyApiError();
  }
  buildDailyMeetingUrl(data.url, options.name, "header.payload.signature");
  return { name: data.name, url: data.url };
}

export async function ensureDailyRoomPrivate(
  apiKey: string,
  roomName: string,
  fetcher: typeof fetch = fetch
) {
  assertDailyRoomName(roomName);
  const data = await dailyJsonRequest(apiKey, `/rooms/${encodeURIComponent(roomName)}`, {
    privacy: "private",
    properties: {
      enable_knocking: false,
      enforce_unique_user_ids: true
    }
  }, fetcher);
  if (!isRecord(data) || data.name !== roomName) throw new DailyApiError();
}

export async function closeDailyRoom(
  apiKey: string,
  roomName: string,
  expiresAt: number,
  fetcher: typeof fetch = fetch
) {
  assertDailyRoomName(roomName);
  if (!Number.isInteger(expiresAt) || expiresAt <= 0) {
    throw new DailyApiError("L'expiration Daily est invalide.");
  }
  const data = await dailyJsonRequest(apiKey, `/rooms/${encodeURIComponent(roomName)}`, {
    privacy: "private",
    properties: {
      nbf: expiresAt - 1,
      exp: expiresAt,
      eject_at_room_exp: true,
      enable_knocking: false,
      enforce_unique_user_ids: true
    }
  }, fetcher);
  if (!isRecord(data) || data.name !== roomName) throw new DailyApiError();
}

export async function updateDailyRoomTimeBounds(
  apiKey: string,
  roomName: string,
  bounds: { nbf: number; exp: number },
  fetcher: typeof fetch = fetch
) {
  assertDailyRoomName(roomName);
  if (!Number.isInteger(bounds.nbf) || !Number.isInteger(bounds.exp) || bounds.nbf <= 0 || bounds.exp <= bounds.nbf) {
    throw new DailyApiError("La fenêtre temporelle Daily est invalide.");
  }
  const data = await dailyJsonRequest(apiKey, `/rooms/${encodeURIComponent(roomName)}`, {
    privacy: "private",
    properties: {
      nbf: bounds.nbf,
      exp: bounds.exp,
      eject_at_room_exp: true,
      enable_knocking: false,
      enforce_unique_user_ids: true
    }
  }, fetcher);
  if (!isRecord(data) || data.name !== roomName) throw new DailyApiError();
}

export async function createDailyMeetingToken(
  apiKey: string,
  options: {
    roomName: string;
    userId: string;
    userName: string;
    isOwner: boolean;
    expiresAt: number;
  },
  fetcher: typeof fetch = fetch
) {
  assertDailyRoomName(options.roomName);
  if (!DAILY_USER_ID_PATTERN.test(options.userId)) {
    throw new DailyApiError("L'identité Daily est invalide.");
  }
  if (!Number.isInteger(options.expiresAt) || options.expiresAt <= 0) {
    throw new DailyApiError("L'expiration Daily est invalide.");
  }
  const userName = options.userName
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Participant";
  const permissions = options.isOwner
    ? { hasPresence: true, canSend: true, canAdmin: true }
    : { hasPresence: true, canSend: ["video", "audio"], canAdmin: false };
  const data = await dailyJsonRequest(apiKey, "/meeting-tokens", {
    properties: {
      room_name: options.roomName,
      user_id: options.userId,
      user_name: userName,
      is_owner: options.isOwner,
      exp: options.expiresAt,
      eject_at_token_exp: false,
      enable_prejoin_ui: true,
      enable_screenshare: options.isOwner,
      lang: "fr",
      permissions
    }
  }, fetcher);

  if (!isRecord(data) || typeof data.token !== "string" || !DAILY_TOKEN_PATTERN.test(data.token)) {
    throw new DailyApiError();
  }
  return data.token;
}

export type LiveJoinDecision =
  | { allowed: true; expiresAt: number }
  | { allowed: false; reason: "too_early"; retryAfterSeconds: number }
  | { allowed: false; reason: "ended" | "invalid" };

export function isAllowedLiveStatusTransition(current: LiveSessionStatus, next: LiveSessionStatus) {
  if (current === next) return true;
  const transitions: Record<LiveSessionStatus, ReadonlySet<LiveSessionStatus>> = {
    scheduled: new Set(["live", "ended", "cancelled"]),
    live: new Set(["ended", "cancelled"]),
    ended: new Set(),
    cancelled: new Set()
  };
  return transitions[current].has(next);
}

export function getLiveJoinDecision(
  session: Pick<LiveSession, "starts_at" | "ends_at" | "status">,
  staff: boolean,
  nowMs = Date.now()
): LiveJoinDecision {
  if (session.status === "cancelled" || session.status === "ended") return { allowed: false, reason: "ended" };
  const startsAt = Date.parse(session.starts_at);
  if (!Number.isFinite(startsAt)) return { allowed: false, reason: "invalid" };
  const fallbackEnd = startsAt + DEFAULT_SESSION_DURATION_MS;
  const endsAt = session.ends_at ? Date.parse(session.ends_at) : fallbackEnd;
  if (!Number.isFinite(endsAt) || endsAt <= startsAt) return { allowed: false, reason: "invalid" };

  const opensAt = startsAt - (staff ? STAFF_EARLY_JOIN_MS : STUDENT_EARLY_JOIN_MS);
  if (nowMs < opensAt) {
    return {
      allowed: false,
      reason: "too_early",
      retryAfterSeconds: Math.max(1, Math.ceil((opensAt - nowMs) / 1000))
    };
  }
  if (nowMs >= endsAt) return { allowed: false, reason: "ended" };

  return {
    allowed: true,
    expiresAt: Math.min(Math.floor(nowMs / 1000) + JOIN_TOKEN_TTL_SECONDS, Math.floor(endsAt / 1000))
  };
}

export type LiveAccessContext = {
  verified: boolean;
  staff: boolean;
  annualPass: boolean;
  courseIds: Set<string>;
};

type LiveEnrollment = {
  course_id: string | null;
  statut?: string | null;
  access_source?: string | null;
  access_expires_at?: string | null;
};

export function getAccessibleLiveCourseIds(
  enrollments: LiveEnrollment[],
  activeAnnualPass: boolean,
  now = Date.now()
) {
  return new Set(enrollments
    .filter(enrollment => isActiveCourseEnrollment({
      accessExpiresAt: enrollment.access_expires_at,
      accessSource: enrollment.access_source,
      activeAnnualPass,
      now,
      status: enrollment.statut
    }))
    .map(enrollment => enrollment.course_id)
    .filter((courseId): courseId is string => Boolean(courseId)));
}

// Reproduces the access gating used by /api/me: staff and active annual pass
// holders see every session; otherwise a session tied to a course is reachable
// only by students enrolled in that course.
export async function getStudentLiveContext(supabase: ServerClient, userId: string, role: string): Promise<LiveAccessContext> {
  const staff = role === "directeur" || role === "formateur";
  if (staff) {
    return { verified: true, staff: true, annualPass: true, courseIds: new Set() };
  }

  const nowIso = new Date().toISOString();
  const [{ data: pass, error: passError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    supabase
      .from("annual_access_passes")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("course_enrollments")
      .select("course_id,statut,access_source,access_expires_at")
      .eq("etudiant_id", userId)
      .eq("statut", "en_cours")
  ]);

  if (passError || enrollmentError) {
    return { verified: false, staff: false, annualPass: false, courseIds: new Set() };
  }

  const annualPass = Boolean(pass);

  return {
    verified: true,
    staff: false,
    annualPass,
    courseIds: getAccessibleLiveCourseIds((enrollments || []) as LiveEnrollment[], annualPass)
  };
}

export function canAccessSession(ctx: LiveAccessContext, session: Pick<LiveSession, "course_id">) {
  if (!ctx.verified) return false;
  if (ctx.staff || ctx.annualPass) return true;
  return Boolean(session.course_id && ctx.courseIds.has(session.course_id));
}
