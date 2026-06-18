import type { createServerClient } from "@/lib/supabase";
import { getSystemSettings } from "@/lib/settings";

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>;

const DAILY_API = "https://api.daily.co/v1";

export type LiveSessionStatus = "scheduled" | "live" | "ended" | "cancelled";

export type LiveSession = {
  id: string;
  titre: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  course_id: string | null;
  daily_room_name: string | null;
  daily_room_url: string | null;
  status: LiveSessionStatus;
  created_at?: string;
  updated_at?: string;
};

// Public-facing shape: never leaks the Daily room URL in list endpoints.
export type PublicLiveSession = Omit<LiveSession, "daily_room_name" | "daily_room_url" | "created_at" | "updated_at"> & {
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

export async function createDailyRoom(apiKey: string, options: { name: string; exp?: number }) {
  const response = await fetch(`${DAILY_API}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: options.name,
      privacy: "public",
      properties: {
        ...(options.exp ? { exp: options.exp } : {}),
        enable_prejoin_ui: true,
        enable_chat: true,
        enable_screenshare: true
      }
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.info || data?.error || "La salle Daily n'a pas pu être créée.");
  }
  return data as { name: string; url: string };
}

export type LiveAccessContext = {
  staff: boolean;
  annualPass: boolean;
  courseIds: Set<string>;
};

// Reproduces the access gating used by /api/me: staff and active annual pass
// holders see every session; otherwise a session tied to a course is reachable
// only by students enrolled in that course.
export async function getStudentLiveContext(supabase: ServerClient, userId: string, role: string): Promise<LiveAccessContext> {
  const staff = role === "directeur" || role === "formateur";
  if (staff) {
    return { staff: true, annualPass: true, courseIds: new Set() };
  }

  const nowIso = new Date().toISOString();
  const [{ data: pass }, { data: enrollments }] = await Promise.all([
    supabase
      .from("annual_access_passes")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .limit(1)
      .maybeSingle(),
    supabase.from("course_enrollments").select("course_id").eq("etudiant_id", userId)
  ]);

  return {
    staff: false,
    annualPass: Boolean(pass),
    courseIds: new Set(((enrollments || []) as { course_id: string | null }[]).map(item => item.course_id).filter(Boolean) as string[])
  };
}

export function canAccessSession(ctx: LiveAccessContext, session: Pick<LiveSession, "course_id">) {
  if (ctx.staff || ctx.annualPass) return true;
  return Boolean(session.course_id && ctx.courseIds.has(session.course_id));
}
