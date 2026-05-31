import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { authorizeDirector } from "@/lib/server-auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const auth = await authorizeDirector(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });
  const { data, error } = await supabase.from("profiles").update({
    statut_inscription: body.statut || "validee",
    updated_at: new Date().toISOString()
  }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (data.statut_inscription !== (body.statut || "validee")) {
    return NextResponse.json({ ok: false, verified: false, error: "Payment status verification failed" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, verified: true, data });
}
