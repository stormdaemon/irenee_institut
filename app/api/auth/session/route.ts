import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth-cookie";
import { SESSION_TTL_SECONDS, verifyAccessToken } from "@/lib/local-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!token) return NextResponse.json({ ok: false, error: "Connexion requise." }, { status: 401 });

  const { expiresAt, user, error } = await verifyAccessToken(token);
  if (error || !user) {
    return NextResponse.json({ ok: false, error: error?.message || "Session invalide." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, user });
  setSessionCookie(response, {
    access_token: token,
    expires_at: expiresAt || Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    expires_in: expiresAt ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000)) : SESSION_TTL_SECONDS,
    token_type: "bearer",
    user
  });
  return response;
}
