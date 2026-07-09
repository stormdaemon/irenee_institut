import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/local-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!token) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { user, error } = await verifyAccessToken(token);
  if (error || !user) return NextResponse.json({ error: error?.message || "Session invalide." }, { status: 401 });
  return NextResponse.json({ user });
}
