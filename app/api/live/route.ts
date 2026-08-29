import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { canAccessSession, getLiveJoinDecision, getStudentLiveContext, toPublicSession } from "@/lib/live";
import type { LiveSession } from "@/lib/live";

// Returns the upcoming / live sessions the authenticated user may join, ordered
// by start time. The Daily room URL is never included here (see /api/live/[id]).
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { data: profile, error: profileError } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("live_list_profile_failed", { userId: auth.user.id });
    return NextResponse.json({ ok: false, error: "Les séances ne peuvent pas être chargées." }, {
      headers: { "Cache-Control": "no-store" },
      status: 503
    });
  }
  const role = (profile?.role as string) || "etudiant";

  const ctx = await getStudentLiveContext(auth.supabase, auth.user.id, role);
  if (!ctx.verified) {
    console.error("live_list_access_lookup_failed", { userId: auth.user.id });
    return NextResponse.json({ ok: false, error: "Votre accès aux séances ne peut pas être vérifié." }, {
      headers: { "Cache-Control": "no-store" },
      status: 503
    });
  }
  const nowMs = Date.now();

  let sessionsQuery = auth.supabase
    .from("live_sessions")
    .select("id,titre,description,starts_at,ends_at,course_id,created_by,daily_room_name,daily_room_url,status")
    .in("status", ["scheduled", "live"])
    .order("starts_at", { ascending: true });
  if (role === "formateur") {
    sessionsQuery = sessionsQuery.eq("created_by", auth.user.id);
  }
  const { data, error } = await sessionsQuery;

  if (error) {
    console.error("live_list_lookup_failed", { userId: auth.user.id });
    return NextResponse.json({ ok: false, error: "Les séances ne peuvent pas être chargées." }, {
      headers: { "Cache-Control": "no-store" },
      status: 503
    });
  }

  const sessions = ((data || []) as LiveSession[])
    .filter(session => {
      const decision = getLiveJoinDecision(session, nowMs);
      return decision.allowed || decision.reason === "too_early";
    })
    .filter(session => canAccessSession(ctx, session))
    .map(toPublicSession);

  return NextResponse.json({ ok: true, sessions }, { headers: { "Cache-Control": "no-store" } });
}
