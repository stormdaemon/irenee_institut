import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth-cookie";
import { runRegistrationAutomation } from "@/lib/google-apps-script";
import { sessionContextFromRequest, signUpWithPassword } from "@/lib/local-auth";
import { checkRateLimitHierarchy } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { assertSameOrigin, getTrustedClientIp, RequestSecurityError, safeInternalPath } from "@/lib/request-security";
import { recordSecurityEvent } from "@/lib/security-audit";

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9 ()\-.]{6,30}$/;

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
  const password = String(body.password || "");
  const passwordConfirmation = String(body.passwordConfirmation || "");
  const rawMetadata = typeof body.metadata === "object" && body.metadata ? body.metadata as Record<string, unknown> : {};
  const telephone = String(rawMetadata.telephone || "").replace(/\s+/g, " ").trim().slice(0, 30);
  const metadata = {
    nom: String(rawMetadata.nom || "").slice(0, 120),
    prenom: String(rawMetadata.prenom || "").slice(0, 120),
    telephone
  };
  const nextPath = safeInternalPath(body.next, "/espace-etudiant");

  if (!emailPattern.test(email) || email.length > 254) return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  if (!phonePattern.test(telephone)) return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
  if (password !== passwordConfirmation) {
    return NextResponse.json({ error: "Les deux mots de passe ne correspondent pas." }, { status: 400 });
  }

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

  const result = await signUpWithPassword({ email, metadata, password }, sessionContextFromRequest(request));
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  if (!result.session || !result.user || result.identities.length === 0) {
    return NextResponse.json({ error: "Cette adresse email est déjà utilisée." }, {
      headers: { "Cache-Control": "no-store" },
      status: 409
    });
  }

  const storedMetadata = result.user.user_metadata || {};
  const automationWarnings = await runRegistrationAutomation({
    email: result.user.email,
    id: result.user.id,
    nom: String(storedMetadata.nom || ""),
    prenom: String(storedMetadata.prenom || ""),
    telephone: String(storedMetadata.telephone || "")
  }).catch(error => [error instanceof Error ? error.message : String(error)]);
  await recordSecurityEvent({ actorUserId: result.user.id, eventType: "auth.signup.created", request });
  if (automationWarnings.length) {
    await recordSecurityEvent({ actorUserId: result.user.id, eventType: "auth.signup.delivery_failed", request });
  }

  const response = NextResponse.json({
    automationWarning: automationWarnings.length > 0,
    next: nextPath,
    session: {
      expires_at: result.session.expires_at,
      expires_in: result.session.expires_in,
      token_type: "cookie",
      user: result.user
    },
    user: { ...result.user, identities: result.identities }
  }, {
    headers: { "Cache-Control": "no-store" },
    status: 201
  });
  setSessionCookie(response, result.session);
  return response;
}
