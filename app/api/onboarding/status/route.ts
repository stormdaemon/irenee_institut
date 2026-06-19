import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("role,onboarding_completed_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, needsOnboarding: false }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    needsOnboarding: data?.role === "etudiant" && !data?.onboarding_completed_at
  });
}
