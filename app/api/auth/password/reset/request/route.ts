import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/google-apps-script";
import { issuePasswordResetToken } from "@/lib/password-reset";
import { checkRateLimitHierarchy } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { assertSameOrigin, getTrustedClientIp, RequestSecurityError } from "@/lib/request-security";
import { hashAuditSubject, recordSecurityEvent } from "@/lib/security-audit";

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_ACCEPTED_RESPONSE_MS = 700;

async function acceptedResponse(startedAt: number) {
  // Mail delivery happens only for a real account. A response floor reduces
  // the timing signal between that branch and a missing address while the
  // per-IP limiter bounds the number of concurrent delayed requests.
  const remaining = MINIMUM_ACCEPTED_RESPONSE_MS - (performance.now() - startedAt);
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
  return NextResponse.json(
    {
      accepted: true,
      message: "Si un compte actif correspond à cette adresse, un lien de réinitialisation vient d'être envoyé."
    },
    { headers: { "Cache-Control": "no-store" }, status: 202 }
  );
}

export async function POST(request: Request) {
  const startedAt = performance.now();
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

  const email = String(body.email || "").trim().toLowerCase().slice(0, 255);
  const limits = await checkRateLimitHierarchy(
    { key: `password-reset-request:ip:${getTrustedClientIp(request)}`, limit: 10, windowMs: 60 * 60 * 1000 },
    { key: `password-reset-request:account:${email}`, limit: 3, windowMs: 60 * 60 * 1000 }
  );
  if (!limits.broad.allowed || !limits.specific?.allowed) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessayez plus tard." },
      {
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.max(limits.broad.retryAfterSeconds, limits.specific?.retryAfterSeconds || 0))
        },
        status: 429
      }
    );
  }

  if (!emailPattern.test(email) || email.length > 254) return acceptedResponse(startedAt);

  try {
    const result = await issuePasswordResetToken(email);
    if (result.user && result.resetToken) {
      const metadata = result.user.user_metadata || {};
      try {
        await sendPasswordResetEmail({
          email: result.user.email,
          nom: String(metadata.nom || ""),
          prenom: String(metadata.prenom || ""),
          token: result.resetToken
        });
        await recordSecurityEvent({
          actorUserId: result.user.id,
          eventType: "auth.password.reset_requested",
          request
        });
      } catch {
        // Never log the delivery error object: an upstream provider could echo
        // the URL (and therefore the one-time credential) in its error text.
        console.error("password_reset_email_delivery_failed", { subjectHash: hashAuditSubject(email) });
        await recordSecurityEvent({
          actorUserId: result.user.id,
          eventType: "auth.password.reset_delivery_failed",
          request
        });
      }
    }
  } catch {
    // Database and existence details intentionally remain private.
    console.error("password_reset_request_failed", { subjectHash: hashAuditSubject(email) });
  }

  return acceptedResponse(startedAt);
}
