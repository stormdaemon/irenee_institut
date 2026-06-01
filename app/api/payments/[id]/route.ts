import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";

const allowedStatuses = new Set(["en_attente", "validee", "refusee"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.statut || "validee");
  if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "Statut de paiement invalide." }, { status: 400 });

  const { data, error } = await auth.supabase.from("profiles").update({
    statut_inscription: status,
    updated_at: new Date().toISOString()
  }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (data.statut_inscription !== status) {
    return NextResponse.json({ ok: false, verified: false, error: "Payment status verification failed" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, verified: true, data });
}
