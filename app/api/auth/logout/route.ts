import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-cookie";
import { getRequestSessionToken, revokeAccessToken } from "@/lib/local-auth";
import { assertSameOrigin, RequestSecurityError } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { token, viaCookie } = getRequestSessionToken(request);
  if (viaCookie) {
    try {
      assertSameOrigin(request);
    } catch (error) {
      return NextResponse.json({ ok: false, error: "Requête refusée." }, {
        status: error instanceof RequestSecurityError ? error.status : 403
      });
    }
  }
  if (token) await revokeAccessToken(token);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
