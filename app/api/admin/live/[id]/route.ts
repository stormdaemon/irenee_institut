import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import type { LiveSessionStatus } from "@/lib/live";

const allowedStatuses = new Set<LiveSessionStatus>(["scheduled", "live", "ended", "cancelled"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.status === "string") {
    if (!allowedStatuses.has(body.status as LiveSessionStatus)) {
      return NextResponse.json({ ok: false, error: "Statut de séance invalide." }, { status: 400 });
    }
    update.status = body.status;
  }
  if (typeof body.titre === "string" && body.titre.trim()) update.titre = body.titre.trim();
  if (typeof body.description === "string") update.description = body.description.trim();
  if (typeof body.starts_at === "string" && !Number.isNaN(Date.parse(body.starts_at))) {
    update.starts_at = new Date(body.starts_at).toISOString();
  }
  if (typeof body.ends_at === "string") {
    update.ends_at = Number.isNaN(Date.parse(body.ends_at)) ? null : new Date(body.ends_at).toISOString();
  }

  const { data, error } = await auth.supabase
    .from("live_sessions")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, session: data });
}
