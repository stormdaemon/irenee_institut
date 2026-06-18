import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { canAccessSession, getStudentLiveContext, toPublicSession } from "@/lib/live";
import type { LiveSession } from "@/lib/live";

// Returns the upcoming / live sessions the authenticated user may join, ordered
// by start time. The Daily room URL is never included here (see /api/live/[id]).
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile?.role as string) || "etudiant";

  const ctx = await getStudentLiveContext(auth.supabase, auth.user.id, role);
  const nowIso = new Date().toISOString();

  const { data, error } = await auth.supabase
    .from("live_sessions")
    .select("*")
    .in("status", ["scheduled", "live"])
    .order("starts_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const sessions = ((data || []) as LiveSession[])
    .filter(session => !session.ends_at || session.ends_at > nowIso)
    .filter(session => canAccessSession(ctx, session))
    .map(toPublicSession);

  return NextResponse.json({ ok: true, sessions });
}
