import { pgUpdate } from "@/lib/postgres";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const completedAt = new Date().toISOString();
  const { data, error } = await pgUpdate("profiles", {
      onboarding_completed_at: completedAt,
      updated_at: completedAt
    }, "t.\"id\" = $1", [auth.user.id], { returning: "one", columns: "id,onboarding_completed_at" });

  if (error) {
    return NextResponse.json({
      ok: false,
      error: "Votre accueil n'a pas pu être finalisé. Réessayez dans un instant."
    }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data });
}
