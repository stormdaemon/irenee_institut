import { pgRead } from "@/lib/postgres";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { canAccessSession, getLiveJoinDecision, getStudentLiveContext, toPublicSession } from "@/lib/live";
import type { LiveSession } from "@/lib/live";

// Returns the upcoming / live sessions the authenticated user may join, ordered
// by start time. The Daily room URL is never included here (see /api/live/[id]).
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { data: profile, error: profileError } = await pgRead("select t.\"role\" from public.\"profiles\" t where t.\"id\" = $1", [auth.user.id], "optional");
  if (profileError) {
    console.error("live_list_profile_failed", { userId: auth.user.id });
    return NextResponse.json({ ok: false, error: "Les séances ne peuvent pas être chargées." }, {
      headers: { "Cache-Control": "no-store" },
      status: 503
    });
  }
  const role = (profile?.role as string) || "etudiant";

  const ctx = await getStudentLiveContext(auth.context, auth.user.id, role);
  if (!ctx.verified) {
    console.error("live_list_access_lookup_failed", { userId: auth.user.id });
    return NextResponse.json({ ok: false, error: "Votre accès aux séances ne peut pas être vérifié." }, {
      headers: { "Cache-Control": "no-store" },
      status: 503
    });
  }
  const nowMs = Date.now();

  // Un formateur est traité comme staff par canAccessSession : il voit toutes
  // les séances actives, pas seulement celles qu'il a lui-même créées.
  const { data, error } = await pgRead("select t.\"id\", t.\"titre\", t.\"description\", t.\"starts_at\", t.\"ends_at\", t.\"course_id\", t.\"created_by\", t.\"daily_room_name\", t.\"daily_room_url\", t.\"status\" from public.\"live_sessions\" t where t.\"status\" = any($1) order by t.\"starts_at\" asc", [["scheduled", "live"]], "many");

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
