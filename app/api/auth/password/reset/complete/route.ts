import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { checkRateLimitHierarchy } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { assertSameOrigin, getTrustedClientIp, RequestSecurityError } from "@/lib/request-security";
import { recordSecurityEvent } from "@/lib/security-audit";

export const runtime = "nodejs";

const invalidLinkMessage = "Lien de réinitialisation invalide ou expiré.";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json(
      { error: "Requête refusée." },
      {
        headers: { "Cache-Control": "no-store" },
        status: error instanceof RequestSecurityError ? error.status : 403
      }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 4_096);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message },
        { headers: { "Cache-Control": "no-store" }, status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Requête invalide." },
      { headers: { "Cache-Control": "no-store" }, status: 400 }
    );
  }

  const code = String(body.code || "").slice(0, 257);
  const password = String(body.password || "");
  const passwordConfirmation = String(body.passwordConfirmation || "");
  const limits = await checkRateLimitHierarchy(
    { key: `password-reset-complete:ip:${getTrustedClientIp(request)}`, limit: 20, windowMs: 15 * 60 * 1000 },
    { key: `password-reset-complete:token:${code}`, limit: 5, windowMs: 15 * 60 * 1000 }
  );
  if (!limits.broad.allowed || !limits.specific?.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      {
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.max(limits.broad.retryAfterSeconds, limits.specific?.retryAfterSeconds || 0))
        },
        status: 429
      }
    );
  }

  if (password !== passwordConfirmation) {
    return NextResponse.json(
      { error: "Les deux nouveaux mots de passe ne correspondent pas." },
      { headers: { "Cache-Control": "no-store" }, status: 400 }
    );
  }

  const result = await resetPasswordWithToken(code, password);
  if (result.error || !result.userId) {
    const isPasswordError = /mot de passe|caractères|octets|courant/i.test(result.error?.message || "");
    await recordSecurityEvent({
      eventType: "auth.password.reset_failed",
      request
    });
    return NextResponse.json(
      { error: isPasswordError ? result.error?.message : invalidLinkMessage },
      { headers: { "Cache-Control": "no-store" }, status: 400 }
    );
  }

  await recordSecurityEvent({
    actorUserId: result.userId,
    eventType: "auth.password.reset_completed",
    request
  });
  return NextResponse.json(
    { ok: true, reauthenticationRequired: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
