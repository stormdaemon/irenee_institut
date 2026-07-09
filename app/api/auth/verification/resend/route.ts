import { NextResponse } from "next/server";
import { sendEmailVerification } from "@/lib/google-apps-script";
import { issueEmailVerificationToken } from "@/lib/local-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { assertSameOrigin, getTrustedClientIp, RequestSecurityError, safeInternalPath } from "@/lib/request-security";
import { hashAuditSubject, recordSecurityEvent } from "@/lib/security-audit";

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function acceptedResponse() {
  return NextResponse.json(
    { accepted: true, message: "Si ce compte attend une confirmation, un nouveau lien vient d'être envoyé." },
    { headers: { "Cache-Control": "no-store" }, status: 202 }
  );
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json(
      { error: "Requête refusée." },
      { status: error instanceof RequestSecurityError ? error.status : 403 }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 4_096);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 255);
  const nextPath = safeInternalPath(body.next, "/espace-etudiant");
  const ipLimit = await checkRateLimit(`verification-resend:ip:${getTrustedClientIp(request)}`, 10, 60 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessayez plus tard." },
      { headers: { "Retry-After": String(ipLimit.retryAfterSeconds) }, status: 429 }
    );
  }
  if (!emailPattern.test(email) || email.length > 254) return acceptedResponse();

  const accountLimit = await checkRateLimit(`verification-resend:account:${email}`, 3, 60 * 60 * 1000);
  if (!accountLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessayez plus tard." },
      { headers: { "Retry-After": String(accountLimit.retryAfterSeconds) }, status: 429 }
    );
  }

  try {
    const result = await issueEmailVerificationToken(email);
    if (result.user && result.verificationToken) {
      const metadata = result.user.user_metadata || {};
      await sendEmailVerification({
        email: result.user.email,
        nom: String(metadata.nom || ""),
        nextPath,
        prenom: String(metadata.prenom || ""),
        token: result.verificationToken
      });
      await recordSecurityEvent({ actorUserId: result.user.id, eventType: "auth.email.verification_resent", request });
    }
  } catch (error) {
    console.error("verification_email_resend_failed", {
      error: error instanceof Error ? error.message : String(error),
      subjectHash: hashAuditSubject(email)
    });
  }

  return acceptedResponse();
}
