import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

const allowedFields = [
  "formation_choisie",
  "modalite_paiement",
  "moyen_paiement",
  "nom",
  "prenom",
  "tarif_applicable",
  "telephone"
] as const;

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const payload = Object.fromEntries(allowedFields.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
  const { data, error } = await auth.supabase.from("profiles").upsert({
    ...payload,
    id: auth.user.id,
    email: auth.user.email || "",
    updated_at: new Date().toISOString()
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true, data });
}
