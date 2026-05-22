import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json();
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });
  if (!body.user_id && !body.id) return NextResponse.json({ ok: false, error: "user_id is required to update profile registration" }, { status: 400 });

  const payload = {
    id: body.user_id || body.id,
    email: body.email,
    prenom: body.prenom,
    nom: body.nom,
    telephone: body.telephone,
    role: body.role || "etudiant",
    formation_choisie: body.formation_choisie || body.formationChoisie,
    tarif_applicable: body.tarif_applicable || body.tarifApplicable,
    modalite_paiement: body.modalite_paiement || body.modalitePaiement,
    moyen_paiement: body.moyen_paiement || body.moyenPaiement,
    statut_inscription: body.statut_inscription || "en_attente",
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from("profiles").upsert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true, data });
}
