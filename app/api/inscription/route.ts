import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { authorizeBearerUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const body = await request.json();
  const auth = await authorizeBearerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  if (!body.user_id && !body.id) return NextResponse.json({ ok: false, error: "user_id is required to update profile registration" }, { status: 400 });
  if ((body.user_id || body.id) !== auth.user.id) {
    return NextResponse.json({ ok: false, error: "Vous ne pouvez finaliser que votre propre inscription." }, { status: 403 });
  }

  const marketingOptIn = body.marketing_opt_in !== false;
  const payload = {
    id: auth.user.id,
    email: auth.user.email || body.email,
    prenom: body.prenom,
    nom: body.nom,
    telephone: body.telephone,
    role: "etudiant",
    formation_choisie: body.formation_choisie || body.formationChoisie,
    tarif_applicable: body.tarif_applicable || body.tarifApplicable,
    modalite_paiement: body.modalite_paiement || body.modalitePaiement,
    moyen_paiement: body.moyen_paiement || body.moyenPaiement,
    statut_inscription: body.statut_inscription || "en_attente",
    marketing_opt_in: marketingOptIn,
    marketing_opt_in_at: marketingOptIn ? new Date().toISOString() : null,
    marketing_opt_out_at: marketingOptIn ? null : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from("profiles").upsert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true, data });
}
