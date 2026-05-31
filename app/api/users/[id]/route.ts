import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { authorizeDirector } from "@/lib/server-auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDirector(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { supabase } = auth;
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });
  const { error: profileError } = await supabase.from("profiles").delete().eq("id", id);
  const deletion = await supabase.auth.admin.deleteUser(id);
  if (profileError || deletion.error) return NextResponse.json({ error: profileError?.message || deletion.error?.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
