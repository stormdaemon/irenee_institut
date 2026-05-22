import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });
  const { error: profileError } = await supabase.from("profiles").delete().eq("id", id);
  const auth = await supabase.auth.admin.deleteUser(id);
  if (profileError || auth.error) return NextResponse.json({ error: profileError?.message || auth.error?.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
