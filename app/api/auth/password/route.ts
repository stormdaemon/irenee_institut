import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { clearSessionCookie } from "@/lib/auth-cookie";
import { changePassword } from "@/lib/local-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { getTrustedClientIp } from "@/lib/request-security";
import { recordSecurityEvent } from "@/lib/security-audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const [userLimit, ipLimit] = await Promise.all([
    checkRateLimit(`password-change:user:${auth.user.id}`, 5, 15 * 60 * 1000),
    checkRateLimit(`password-change:ip:${getTrustedClientIp(request)}`, 20, 15 * 60 * 1000)
  ]);
  if (!userLimit.allowed || !ipLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      {
        headers: { "Retry-After": String(Math.max(userLimit.retryAfterSeconds, ipLimit.retryAfterSeconds)) },
        status: 429
      }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 8_192);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const currentPassword = String(body.currentPassword || "");
  const nextPassword = String(body.nextPassword || "");
  const passwordConfirmation = String(body.passwordConfirmation || "");
  if (nextPassword !== passwordConfirmation) {
    return NextResponse.json({ error: "Les deux nouveaux mots de passe ne correspondent pas." }, { status: 400 });
  }

  const changed = await changePassword(auth.user.id, currentPassword, nextPassword);
  if (changed.error) {
    await recordSecurityEvent({ actorUserId: auth.user.id, eventType: "auth.password.change_failed", request });
    return NextResponse.json({ error: changed.error.message }, { status: 400 });
  }

  await recordSecurityEvent({ actorUserId: auth.user.id, eventType: "auth.password.changed", request });
  const response = NextResponse.json(
    { ok: true, reauthenticationRequired: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  clearSessionCookie(response);
  return response;
}
