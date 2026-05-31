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
  const { data, error } = await supabase.from("homework_assignments").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true, data });
}
