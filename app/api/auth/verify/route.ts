import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth-cookie";
import { runRegistrationAutomation } from "@/lib/google-apps-script";
import { sessionContextFromRequest, verifyEmailToken } from "@/lib/local-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { assertSameOrigin, getTrustedClientIp, RequestSecurityError, safeInternalPath } from "@/lib/request-security";
import { recordSecurityEvent } from "@/lib/security-audit";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json({ error: "Requête refusée." }, {
      status: error instanceof RequestSecurityError ? error.status : 403
    });
  }
  const limit = await checkRateLimit(`verify:ip:${getTrustedClientIp(request)}`, 20, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
      status: 429
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 4096);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const code = String(body.code || "");
  const password = String(body.password || "");
  const passwordConfirmation = String(body.passwordConfirmation || "");
  if (password !== passwordConfirmation) {
    return NextResponse.json({ error: "Les deux mots de passe ne correspondent pas." }, { status: 400 });
  }
  const result = await verifyEmailToken(code, password, sessionContextFromRequest(request));
  if (result.error || !result.session || !result.user) {
    const isPasswordError = /mot de passe|caractères|octets|courant/i.test(result.error?.message || "");
    return NextResponse.json({
      error: isPasswordError ? result.error?.message : "Lien de confirmation invalide ou expiré."
    }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: profile } = supabase
    ? await supabase.from("profiles").select("*").eq("id", result.user.id).maybeSingle()
    : { data: null };
  if (profile) await runRegistrationAutomation(profile).catch(() => undefined);
  await recordSecurityEvent({ actorUserId: result.user.id, eventType: "auth.email.verified", request });

  const response = NextResponse.json({
    next: safeInternalPath(body.next, "/espace-etudiant"),
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
