import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { authorizeBearerUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const { avatar_public_id, avatar_url, user_id } = await request.json();
  const auth = await authorizeBearerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  if (!user_id) return NextResponse.json({ error: "user_id is required server-side" }, { status: 400 });
  if (user_id !== auth.user.id) {
    return NextResponse.json({ ok: false, error: "Vous ne pouvez modifier que votre propre photo." }, { status: 403 });
  }
  const { data, error } = await supabase.from("profiles").update({
    avatar_public_id,
    avatar_url: avatar_url || avatar_public_id,
    updated_at: new Date().toISOString()
  }).eq("id", user_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true, data });
}
