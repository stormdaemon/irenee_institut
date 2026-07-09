import { NextResponse } from "next/server";
import { sendEmailVerification } from "@/lib/google-apps-script";
import { beginEmailSignUp } from "@/lib/local-auth";
import { checkRateLimitHierarchy } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { assertSameOrigin, getTrustedClientIp, RequestSecurityError, safeInternalPath } from "@/lib/request-security";
import { hashAuditSubject, recordSecurityEvent } from "@/lib/security-audit";

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json({ error: "Requête refusée." }, {
      headers: { "Cache-Control": "no-store" },
      status: error instanceof RequestSecurityError ? error.status : 403
    });
  }
  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 16_384);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { headers: { "Cache-Control": "no-store" }, status: error.status });
    }
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const rawMetadata = typeof body.metadata === "object" && body.metadata ? body.metadata as Record<string, unknown> : {};
  const metadata = { nom: String(rawMetadata.nom || "").slice(0, 120), prenom: String(rawMetadata.prenom || "").slice(0, 120) };
  const nextPath = safeInternalPath(body.next, "/espace-etudiant");

  if (!emailPattern.test(email) || email.length > 254) return NextResponse.json({ error: "Email invalide." }, { status: 400 });

  const ip = getTrustedClientIp(request);
  const limits = await checkRateLimitHierarchy(
    { key: `signup:ip:${ip}`, limit: 10, windowMs: 60 * 60 * 1000 },
    { key: `signup:account:${email}`, limit: 3, windowMs: 60 * 60 * 1000 }
  );
  if (!limits.broad.allowed || !limits.specific?.allowed) {
    return NextResponse.json({ error: "Trop de créations de compte. Réessayez plus tard." }, {
      headers: { "Retry-After": String(Math.max(limits.broad.retryAfterSeconds, limits.specific?.retryAfterSeconds || 0)) },
      status: 429
    });
  }

  const result = await beginEmailSignUp({ email, metadata });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });

  if (result.verificationToken && result.user) {
    try {
      const storedMetadata = result.user.user_metadata || {};
      await sendEmailVerification({
        email: result.user.email,
        nom: String(storedMetadata.nom || ""),
        nextPath,
        prenom: String(storedMetadata.prenom || ""),
        token: result.verificationToken
      });
      await recordSecurityEvent({
        actorUserId: result.user.id,
        eventType: result.identities.length ? "auth.signup.created" : "auth.email.verification_resent",
        request
      });
    } catch (error) {
      console.error("verification_email_delivery_failed", {
        error: error instanceof Error ? error.message : String(error),
        subjectHash: hashAuditSubject(email)
      });
      await recordSecurityEvent({ actorUserId: result.user.id, eventType: "auth.signup.delivery_failed", request });
    }
  }

  // The same response is returned for existing and newly-created addresses to prevent enumeration.
  return NextResponse.json({
    confirmationRequired: true,
    message: "Si une confirmation est nécessaire, un lien vient d'être envoyé.",
    session: null,
    user: { email }
  }, {
    headers: { "Cache-Control": "no-store" },
    status: 202
  });
}
