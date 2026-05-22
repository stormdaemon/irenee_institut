import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { avatar_public_id, avatar_url, user_id } = await request.json();
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });
  if (!user_id) return NextResponse.json({ error: "user_id is required server-side" }, { status: 400 });
  const { data, error } = await supabase.from("profiles").update({
    avatar_public_id,
    avatar_url: avatar_url || avatar_public_id,
    updated_at: new Date().toISOString()
  }).eq("id", user_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true, data });
}
