import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { avatar_public_id, avatar_url } = await request.json().catch(() => ({}));
  const { data, error } = await auth.supabase.from("profiles").update({
    avatar_public_id,
    avatar_url: avatar_url || avatar_public_id,
    updated_at: new Date().toISOString()
  }).eq("id", auth.user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true, data });
}
