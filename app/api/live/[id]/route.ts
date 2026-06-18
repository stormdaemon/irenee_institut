import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { canAccessSession, getStudentLiveContext } from "@/lib/live";
import type { LiveSession } from "@/lib/live";

// Resolves a single session and, after verifying the user's access, returns the
// Daily room URL so the /direct/[id] page can embed it. The user authenticates
// with their site account only — no Daily account is required to join.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile?.role as string) || "etudiant";

  const { data, error } = await auth.supabase
    .from("live_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "Séance introuvable." }, { status: 404 });

  const session = data as LiveSession;

  if (session.status === "cancelled" || session.status === "ended") {
    return NextResponse.json({ ok: false, error: "Cette séance n'est plus accessible." }, { status: 410 });
  }

  const ctx = await getStudentLiveContext(auth.supabase, auth.user.id, role);
  if (!canAccessSession(ctx, session)) {
    return NextResponse.json({ ok: false, error: "Vous n'avez pas accès à cette séance." }, { status: 403 });
  }

  if (!session.daily_room_url) {
    return NextResponse.json({ ok: false, error: "La salle de cette séance n'est pas encore prête." }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    session: {
      id: session.id,
      titre: session.titre,
      description: session.description,
      starts_at: session.starts_at,
      ends_at: session.ends_at,
      status: session.status,
      room_url: session.daily_room_url
    }
  });
}
