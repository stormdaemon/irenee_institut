import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { getRequestSessionToken, verifyAccessToken } from "@/lib/local-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { token } = getRequestSessionToken(request);
  const verified = await verifyAccessToken(token);
  return NextResponse.json({
    session: {
      expires_at: verified.expiresAt,
      token_type: "cookie",
      user: auth.user
    },
    user: auth.user
  }, { headers: { "Cache-Control": "no-store" } });
}
