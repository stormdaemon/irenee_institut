import { pgRead } from "@/lib/postgres";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await pgRead("select t.\"role\", t.\"onboarding_completed_at\" from public.\"profiles\" t where t.\"id\" = $1", [auth.user.id], "optional");

  if (error) {
    return NextResponse.json({ ok: false, needsOnboarding: false }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    needsOnboarding: data?.role === "etudiant" && !data?.onboarding_completed_at
  });
}
