import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { verifyAccessToken } from "@/lib/local-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!token) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { user, error } = await verifyAccessToken(token);
  if (error || !user) return NextResponse.json({ error: error?.message || "Session invalide." }, { status: 401 });

  const supabase = createServerClient();
  const { data: profile, error: profileError } = await supabase!
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  return NextResponse.json({ profile });
}
