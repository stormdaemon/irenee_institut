import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth-cookie";
import { sessionContextFromRequest, signInWithPassword } from "@/lib/local-auth";
import { checkRateLimitHierarchy } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { assertSameOrigin, getTrustedClientIp, RequestSecurityError } from "@/lib/request-security";
import { hashAuditSubject, recordSecurityEvent } from "@/lib/security-audit";

export const runtime = "nodejs";

function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, {
    headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds) },
    status: 429
  });
}

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
  if (!email || email.length > 254 || !password || password.length > 128) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 400 });
  }

  const ip = getTrustedClientIp(request);
  const limits = await checkRateLimitHierarchy(
    { key: `login:ip:${ip}`, limit: 30, windowMs: 15 * 60 * 1000 },
    { key: `login:account:${email}`, limit: 8, windowMs: 15 * 60 * 1000 }
  );
  if (!limits.broad.allowed || !limits.specific?.allowed) {
    await recordSecurityEvent({
      eventType: "auth.login.rate_limited",
      metadata: { subject_hash: hashAuditSubject(email) },
      request
    });
    return rateLimited(Math.max(limits.broad.retryAfterSeconds, limits.specific?.retryAfterSeconds || 0));
  }

  const result = await signInWithPassword(email, password, sessionContextFromRequest(request));
  if (result.error || !result.session || !result.user) {
    await recordSecurityEvent({
      eventType: "auth.login.failed",
      metadata: { reason: result.error?.message.includes("Confirmez") ? "unverified" : "invalid", subject_hash: hashAuditSubject(email) },
      request
    });
    return NextResponse.json(
      { error: "Identifiants invalides ou compte non confirmé." },
      { headers: { "Cache-Control": "no-store" }, status: 401 }
    );
  }

  await recordSecurityEvent({ actorUserId: result.user.id, eventType: "auth.login.succeeded", request });
  const response = NextResponse.json({
    session: {
      expires_at: result.session.expires_at,
      expires_in: result.session.expires_in,
      token_type: result.session.token_type,
      user: result.user
    },
    user: result.user
  });
  setSessionCookie(response, result.session);
  return response;
}
