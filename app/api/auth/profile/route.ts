import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { data: profile, error } = await auth.supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) {
    console.error("auth_profile_read_failed", { userId: auth.user.id });
    return NextResponse.json({ error: "Profil indisponible." }, { status: 500 });
  }
  return NextResponse.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
}
