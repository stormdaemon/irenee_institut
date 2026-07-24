import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { POST as signupRoutePost } from "@/app/api/auth/signup/route";
import { POST as syncSessionRoutePost } from "@/app/api/auth/session/route";
import { GET as authUserRouteGet } from "@/app/api/auth/user/route";
import { POST as completeOnboardingRoutePost } from "@/app/api/onboarding/complete/route";
import { GET as onboardingStatusRouteGet } from "@/app/api/onboarding/status/route";
import { setSessionCookie } from "@/lib/auth-cookie";
import { authorizeRequest } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { runRegistrationAutomation } from "@/lib/google-apps-script";
import { translateAuthError } from "@/lib/auth-errors";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";
import { beginEmailSignUp, encodeJwtSecret, signInWithPassword, verifyAccessToken, verifyEmailToken } from "@/lib/local-auth";
import { createServerClient } from "@/lib/supabase";

const testLocalAuthJwtSecret = "test-local-auth-secret-with-more-than-32-characters";
if (!process.env.LOCAL_AUTH_JWT_SECRET) process.env.LOCAL_AUTH_JWT_SECRET = testLocalAuthJwtSecret;

const createdUserIds: string[] = [];
const originalFetch = globalThis.fetch;
const originalAppsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
const originalAppsScriptSecret = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET;
const originalAuthCookieSecure = process.env.AUTH_COOKIE_SECURE;
const originalLocalAuthJwtSecret = process.env.LOCAL_AUTH_JWT_SECRET;

function expect(value: any) {
  return {
    toBe(expected: unknown) {
      assert.equal(value, expected);
    },
    toBeGreaterThanOrEqual(expected: number) {
      assert.ok(value >= expected);
    },
    toBeNull() {
      assert.equal(value, null);
    },
    toBeString() {
      assert.equal(typeof value, "string");
    },
    toContain(expected: string) {
      assert.ok(String(value).includes(expected), `${String(value)} does not contain ${expected}`);
    },
    toHaveLength(expected: number) {
      assert.equal(value.length, expected);
    }
  };
}

function testEmail() {
  return `codex-${randomUUID()}@example.test`;
}

async function createVerifiedUser(input: { email: string; password: string; metadata?: Record<string, unknown> }) {
  const signup = await beginEmailSignUp({ email: input.email, metadata: input.metadata });
  if (!signup.verificationToken) throw new Error("Expected a verification token for the test account.");
  const verified = await verifyEmailToken(signup.verificationToken, input.password);
  return { ...signup, session: verified.session };
}

function authRequest(token: string) {
  return new Request("https://irenee.test/api/test", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function cleanupUser(id: string) {
  await query(`delete from auth.users where id = $1`, [id]).catch(() => undefined);
}

afterEach(async () => {
  globalThis.fetch = originalFetch;
  if (originalAuthCookieSecure === undefined) delete process.env.AUTH_COOKIE_SECURE;
  else process.env.AUTH_COOKIE_SECURE = originalAuthCookieSecure;
  process.env.GOOGLE_APPS_SCRIPT_URL = originalAppsScriptUrl;
  process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET = originalAppsScriptSecret;
  process.env.LOCAL_AUTH_JWT_SECRET = originalLocalAuthJwtSecret;

  while (createdUserIds.length) {
    const id = createdUserIds.pop();
    if (id) await cleanupUser(id);
  }
});

describe("local PostgreSQL auth", () => {
  it("creates a user, signs in with the same password and verifies the issued token", async () => {
    const email = testEmail();
    const signup = await createVerifiedUser({
      email,
      password: "correct-password",
      metadata: { prenom: "Jean", nom: "Test" }
    });
    expect(signup.error).toBeNull();
    expect(signup.user?.email).toBe(email);
    expect(signup.session?.access_token).toBeString();
    createdUserIds.push(signup.user!.id);

    const login = await signInWithPassword(email, "correct-password");
    expect(login.error).toBeNull();
    expect(login.user?.id).toBe(signup.user?.id);

    const verified = await verifyAccessToken(login.session!.access_token);
    expect(verified.error).toBeNull();
    expect(verified.user?.email).toBe(email);
  });

  it("rejects wrong passwords and invalid tokens", async () => {
    const email = testEmail();
    const signup = await createVerifiedUser({ email, password: "correct-password" });
    createdUserIds.push(signup.user!.id);

    const login = await signInWithPassword(email, "wrong-password");
    expect(login.user).toBeNull();
    expect(login.session).toBeNull();
    expect(login.error?.message).toContain("Identifiants");

    const verified = await verifyAccessToken("not-a-jwt");
    expect(verified.user).toBeNull();
    expect(verified.error?.message).toContain("Session invalide");
  });

  it("does not create a second account for an existing email", async () => {
    const email = testEmail();
    const first = await createVerifiedUser({ email, password: "correct-password" });
    createdUserIds.push(first.user!.id);

    const second = await beginEmailSignUp({ email });
    expect(second.error).toBeNull();
    expect(second.session).toBeNull();
    expect(second.identities).toHaveLength(0);
    expect(second.user?.id).toBe(first.user?.id);
  });

  it("creates the account with its chosen password, opens a session and sends the welcome email", async () => {
    const email = testEmail();
    const password = "correct-password";
    process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.google.test/signup";
    process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET = "test-mail-secret";
    process.env.AUTH_COOKIE_SECURE = "false";
    const payloads: Array<Record<string, any>> = [];
    globalThis.fetch = async (_input, init) => {
      const payload = JSON.parse(String(init?.body || "{}"));
      payloads.push(payload);
      return Response.json({ ok: true });
    };

    const signupRequest = (ip: string) => new Request("https://irenee.test/api/auth/signup", {
      body: JSON.stringify({
        email,
        metadata: { prenom: "Double", nom: "Email", telephone: "06 12 34 56 78" },
        next: "/formations?checkout=annual-pass",
        password,
        passwordConfirmation: password
      }),
      headers: {
        "Content-Type": "application/json",
        origin: "https://irenee.test",
        "sec-fetch-site": "same-origin",
        "x-real-ip": ip
      },
      method: "POST"
    });

    const freshResponse = await signupRoutePost(signupRequest(`198.51.${randomInt(1, 255)}.${randomInt(1, 255)}`));
    const freshBody = await freshResponse.json();
    expect(freshResponse.status).toBe(201);
    expect(freshBody.user.email).toBe(email);
    expect(freshBody.session.token_type).toBe("cookie");
    expect(freshBody.next).toBe("/formations?checkout=annual-pass");
    expect(freshBody.automationWarning).toBe(false);
    createdUserIds.push(freshBody.user.id);

    const createdProfile = await query<{ telephone: string | null }>(
      "select telephone from public.profiles where id = $1",
      [freshBody.user.id]
    );
    expect(createdProfile.rows[0]?.telephone).toBe("06 12 34 56 78");

    const withoutPhone = await signupRoutePost(new Request("https://irenee.test/api/auth/signup", {
      body: JSON.stringify({
        email: `sans-telephone-${randomUUID()}@irenee.test`,
        metadata: { prenom: "Sans", nom: "Téléphone" },
        password,
        passwordConfirmation: password
      }),
      headers: {
        "Content-Type": "application/json",
        origin: "https://irenee.test",
        "sec-fetch-site": "same-origin",
        "x-real-ip": `198.51.${randomInt(1, 255)}.${randomInt(1, 255)}`
      },
      method: "POST"
    }));
    expect(withoutPhone.status).toBe(400);

    const cookie = freshResponse.headers.get("set-cookie") || "";
    expect(cookie).toContain("irenee_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");

    const authenticated = await authUserRouteGet(new Request("https://irenee.test/api/auth/user", {
      headers: { Cookie: cookie.split(";")[0] }
    }));
    const authenticatedBody = await authenticated.json();
    expect(authenticated.status).toBe(200);
    expect(authenticatedBody.user.id).toBe(freshBody.user.id);
    expect(authenticatedBody.user.email).toBe(email);

    assert.deepEqual(payloads.map(payload => Object.keys(payload).filter(key => key !== "secret")), [
      ["campaign"],
      ["welcomeRegistration"]
    ]);
    // La notification d'inscription passe par le canal générique : le corps de
    // l'email est construit ici, donc chaque champ collecté doit y figurer.
    const notification = payloads[0]?.campaign;
    assert.equal(notification?.to, "sam3ams@gmail.com,tlafont49@gmail.com,oeuvrecatholiquefrance@gmail.com");
    assert.equal(notification?.subject, "Nouvelle inscription — Double Email");
    for (const expected of ["Double", "Email", email, "06 12 34 56 78"]) {
      assert.ok(String(notification?.body || "").includes(expected), `texte sans ${expected}`);
      assert.ok(String(notification?.htmlBody || "").includes(expected), `html sans ${expected}`);
    }
    assert.deepEqual(payloads[1]?.welcomeRegistration, {
      contactEmail: "contact@irenee-institut.org",
      dashboardUrl: "https://irenee-institut.org/espace-etudiant",
      email,
      nom: "Email",
      prenom: "Double",
      programUrl: "https://irenee-institut.org/formations"
    });
    assert.equal(payloads.some(payload => /Réinitialiser/.test(String(payload.campaign?.subject || ""))), false);

    const login = await signInWithPassword(email, password);
    expect(login.error).toBeNull();
    expect(login.user?.id).toBe(freshBody.user.id);

    const outbox = await query<{ delivery_status: string }>(
      "select delivery_status from public.registration_notification_outbox where user_id = $1",
      [freshBody.user.id]
    );
    expect(outbox.rows[0]?.delivery_status).toBe("sent");

    await query("update auth.users set email = $2 where id = $1", [freshBody.user.id, email.toUpperCase()]);
    const deliveryCount = payloads.length;
    const existingResponse = await signupRoutePost(signupRequest(`203.0.113.${randomInt(1, 255)}`));
    const existingBody = await existingResponse.json();
    expect(existingResponse.status).toBe(409);
    expect(existingBody.error).toContain("déjà utilisée");
    expect(payloads.length).toBe(deliveryCount);
  });

  it("rejects weak JWT configuration before issuing a session", async () => {
    assert.throws(() => encodeJwtSecret("too-short"), /at least 32 characters/);
  });

  it("attaches French password validation errors to the password field", () => {
    const translated = translateAuthError("Ce mot de passe est trop courant.");
    expect(translated.field).toBe("password");
    expect(translated.description).toContain("trop courant");
  });

  it("resynchronizes the HttpOnly server cookie from an existing valid browser token", async () => {
    process.env.AUTH_COOKIE_SECURE = "false";
    const signup = await createVerifiedUser({ email: testEmail(), password: "correct-password" });
    createdUserIds.push(signup.user!.id);

    const response = await syncSessionRoutePost(authRequest(signup.session!.access_token));
    const body = await response.json();
    const cookie = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(cookie).toContain("irenee_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    assert.equal(cookie.includes("Secure"), false);
  });

  it("rejects server cookie resync when the browser token is missing or invalid", async () => {
    const missing = await syncSessionRoutePost(new Request("https://irenee.test/api/auth/session", { method: "POST" }));
    expect(missing.status).toBe(401);
    assert.equal(missing.headers.get("set-cookie"), null);

    const invalid = await syncSessionRoutePost(authRequest("invalid-token"));
    expect(invalid.status).toBe(401);
    assert.equal(invalid.headers.get("set-cookie"), null);
  });
});

describe("Supabase-style profile roles", () => {
  it("uses public.profiles.role for authorization and ignores role metadata from signup", async () => {
    const supabase = createServerClient()!;
    const signup = await createVerifiedUser({
      email: testEmail(),
      password: "correct-password",
      metadata: { prenom: "Role", nom: "Spoof", role: "directeur" }
    });
    createdUserIds.push(signup.user!.id);
    await supabase.from("profiles").upsert({
      email: signup.user!.email,
      id: signup.user!.id,
      nom: "Spoof",
      prenom: "Role",
      role: "etudiant"
    });

    const authRole = await query<{ role: string; metadata_role: string | null }>(
      `select role, raw_user_meta_data->>'role' as metadata_role from auth.users where id = $1`,
      [signup.user!.id]
    );
    expect(authRole.rows[0]?.role).toBe("authenticated");
    expect(authRole.rows[0]?.metadata_role).toBeNull();

    const asDirector = await authorizeRequest(authRequest(signup.session!.access_token), ["directeur"]);
    expect(asDirector.ok).toBe(false);
    if (!asDirector.ok) expect(asDirector.response.status).toBe(403);

    const asStudent = await authorizeRequest(authRequest(signup.session!.access_token), ["etudiant"]);
    expect(asStudent.ok).toBe(true);
  });

  it("allows formateurs on staff endpoints but keeps director-only endpoints restricted", async () => {
    const supabase = createServerClient()!;
    const signup = await createVerifiedUser({ email: testEmail(), password: "correct-password" });
    createdUserIds.push(signup.user!.id);
    await supabase.from("profiles").upsert({
      email: signup.user!.email,
      id: signup.user!.id,
      nom: "Staff",
      prenom: "Formateur",
      role: "formateur"
    });

    const staff = await authorizeRequest(authRequest(signup.session!.access_token), ["directeur", "formateur"]);
    expect(staff.ok).toBe(true);

    const directorOnly = await authorizeRequest(authRequest(signup.session!.access_token), ["directeur"]);
    expect(directorOnly.ok).toBe(false);
    if (!directorOnly.ok) expect(directorOnly.response.status).toBe(403);

    await supabase.from("profiles").update({ role: "directeur" }).eq("id", signup.user!.id);
    const promoted = await authorizeRequest(authRequest(signup.session!.access_token), ["directeur"]);
    expect(promoted.ok).toBe(true);
  });
});

describe("onboarding gate API", () => {
  it("shows onboarding for new students and hides it after completion", async () => {
    const supabase = createServerClient()!;
    const signup = await createVerifiedUser({
      email: testEmail(),
      password: "correct-password",
      metadata: { prenom: "Accueil", nom: "Etudiant" }
    });
    createdUserIds.push(signup.user!.id);
    await supabase.from("profiles").upsert({
      email: signup.user!.email,
      id: signup.user!.id,
      nom: "Etudiant",
      onboarding_completed_at: null,
      prenom: "Accueil",
      role: "etudiant"
    });

    const firstStatus = await onboardingStatusRouteGet(authRequest(signup.session!.access_token));
    const firstBody = await firstStatus.json();
    expect(firstStatus.status).toBe(200);
    expect(firstBody.ok).toBe(true);
    expect(firstBody.needsOnboarding).toBe(true);

    const completed = await completeOnboardingRoutePost(authRequest(signup.session!.access_token));
    const completedBody = await completed.json();
    expect(completed.status).toBe(200);
    expect(completedBody.ok).toBe(true);
    expect(completedBody.data.onboarding_completed_at).toBeString();

    const secondStatus = await onboardingStatusRouteGet(authRequest(signup.session!.access_token));
    const secondBody = await secondStatus.json();
    expect(secondStatus.status).toBe(200);
    expect(secondBody.ok).toBe(true);
    expect(secondBody.needsOnboarding).toBe(false);
  });

  it("rejects onboarding status checks without a session", async () => {
    const response = await onboardingStatusRouteGet(new Request("https://irenee.test/api/onboarding/status"));
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error).toContain("Connexion requise");
  });
});

describe("OWASP baseline controls", () => {
  it("sets HttpOnly session cookies with SameSite protection", async () => {
    process.env.AUTH_COOKIE_SECURE = "false";
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, {
      access_token: "token-value",
      expires_at: Math.floor(Date.now() / 1000) + 60,
      expires_in: 60,
      token_type: "bearer",
      user: { email: "cookie@example.test", id: randomUUID(), user_metadata: {} }
    });

    const cookie = response.headers.get("set-cookie") || "";
    expect(cookie).toContain("irenee_session=token-value");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    assert.equal(cookie.includes("Secure"), false);
  });

  it("marks session cookies Secure when HTTPS deployment is enabled", async () => {
    process.env.AUTH_COOKIE_SECURE = "true";
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, {
      access_token: "token-value",
      expires_at: Math.floor(Date.now() / 1000) + 60,
      expires_in: 60,
      token_type: "bearer",
      user: { email: "secure-cookie@example.test", id: randomUUID(), user_metadata: {} }
    });

    const cookie = response.headers.get("set-cookie") || "";
    expect(cookie).toContain("Secure");
  });

  it("declares restrictive browser security headers", () => {
    const headers = new Map(securityHeaders.map(header => [header.key, header.value]));
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).toContain("base-uri 'self'");
    expect(contentSecurityPolicy).toContain("media-src 'self' https://play.radioking.io");
    expect(contentSecurityPolicy).toContain("script-src-attr 'none'");
    expect(contentSecurityPolicy).toContain("upgrade-insecure-requests");
    assert.equal(contentSecurityPolicy.includes("'unsafe-eval'"), false);
    expect(headers.get("Strict-Transport-Security")).toContain("includeSubDomains");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });
});

describe("local Supabase-compatible PostgreSQL facade", () => {
  it("supports profile upsert/select/update/delete happy path", async () => {
    const supabase = createServerClient()!;
    const id = randomUUID();
    createdUserIds.push(id);
    await query(
      `insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '{}'::jsonb, '{}'::jsonb, now(), now(), false, false)`,
      [id, `profile-${id}@example.test`]
    );

    const upsert = await supabase
      .from("profiles")
      .upsert({ email: `profile-${id}@example.test`, id, nom: "Test", prenom: "Facade", role: "etudiant" })
      .select()
      .single();
    expect(upsert.error).toBeNull();
    expect(upsert.data.id).toBe(id);

    const selected = await supabase.from("profiles").select("id,email,prenom").eq("id", id).maybeSingle();
    expect(selected.error).toBeNull();
    expect(selected.data.prenom).toBe("Facade");

    const updated = await supabase.from("profiles").update({ prenom: "Updated" }).eq("id", id).select("id,prenom").single();
    expect(updated.error).toBeNull();
    expect(updated.data.prenom).toBe("Updated");

    const deleted = await supabase.from("profiles").delete().eq("id", id);
    expect(deleted.error).toBeNull();
    const afterDelete = await supabase.from("profiles").select("id").eq("id", id).maybeSingle();
    expect(afterDelete.data).toBeNull();
  });

  it("returns sad-path errors for unsupported relations and RPC names", async () => {
    const supabase = createServerClient()!;
    const badRelation = await supabase.from("profiles").select("*, unsupported(*)").limit(1);
    expect(badRelation.data).toBeNull();
    expect(badRelation.error?.message).toContain("Unsupported relation");

    const badRpc = await supabase.rpc("missing_rpc", {});
    expect(badRpc.data).toBeNull();
    expect(badRpc.error?.message).toContain("Unsupported RPC");
  });
});

describe("validate_paypal_payment RPC on local PostgreSQL", () => {
  it("activates an annual pass for a valid capture and rejects missing capture ids", async () => {
    const supabase = createServerClient()!;
    const signup = await createVerifiedUser({ email: testEmail(), password: "correct-password", metadata: { prenom: "Pay", nom: "Pal" } });
    createdUserIds.push(signup.user!.id);
    await supabase.from("profiles").upsert({
      email: signup.user!.email,
      id: signup.user!.id,
      nom: "Pal",
      prenom: "Pay",
      role: "etudiant"
    });

    const orderId = `ORDER-${randomUUID()}`;
    const ok = await supabase.rpc("validate_paypal_payment", {
      p_amount_total: 9900,
      p_book_requested: false,
      p_book_title: "",
      p_capture_id: `CAPTURE-${randomUUID()}`,
      p_course_id: null,
      p_currency: "EUR",
      p_event_name: "paypal_capture_completed",
      p_order_id: orderId,
      p_product_type: "annual_pass",
      p_raw_payload: { test: true },
      p_user_id: signup.user!.id
    });
    expect(ok.error).toBeNull();
    expect((ok.data as any).ok).toBe(true);

    const pass = await supabase.from("annual_access_passes").select("id,status").eq("provider_order_id", orderId).maybeSingle();
    expect(pass.data.status).toBe("active");

    const sad = await supabase.rpc("validate_paypal_payment", {
      p_amount_total: 9900,
      p_capture_id: "",
      p_currency: "EUR",
      p_order_id: `ORDER-${randomUUID()}`,
      p_product_type: "annual_pass",
      p_user_id: signup.user!.id
    });
    expect(sad.data).toBeNull();
    expect(sad.error?.message).toContain("capture id is required");
  });

  it("activates an annual pass through the provider-neutral Stripe validation RPC", async () => {
    const supabase = createServerClient()!;
    const signup = await createVerifiedUser({ email: testEmail(), password: "correct-password", metadata: { prenom: "Stri", nom: "Pe" } });
    createdUserIds.push(signup.user!.id);
    await supabase.from("profiles").upsert({
      email: signup.user!.email,
      id: signup.user!.id,
      nom: "Pe",
      prenom: "Stri",
      role: "etudiant"
    });

    const sessionId = `cs_test_${randomUUID()}`;
    const paymentIntentId = `pi_${randomUUID()}`;
    const ok = await supabase.rpc("validate_payment", {
      p_amount_total: 9900,
      p_book_requested: false,
      p_book_title: "",
      p_capture_id: paymentIntentId,
      p_course_id: null,
      p_currency: "EUR",
      p_event_name: "checkout.session.completed",
      p_order_id: sessionId,
      p_product_type: "annual_pass",
      p_provider: "stripe",
      p_raw_payload: { id: sessionId, payment_intent: paymentIntentId },
      p_user_id: signup.user!.id
    });
    expect(ok.error).toBeNull();
    expect((ok.data as any).provider).toBe("stripe");

    const pass = await supabase.from("annual_access_passes").select("provider,status").eq("provider_order_id", sessionId).maybeSingle();
    expect(pass.data.provider).toBe("stripe");
    expect(pass.data.status).toBe("active");

    const event = await supabase.from("payment_events").select("provider,event_name").eq("provider_event_id", paymentIntentId).maybeSingle();
    expect(event.data.provider).toBe("stripe");
    expect(event.data.event_name).toBe("checkout.session.completed");
  });
});

describe("Google Apps Script registration automation", () => {
  it("sends registration and welcome payloads, then enrolls the profile in the mandatory campaign without a duplicate email", async () => {
    const signup = await createVerifiedUser({ email: testEmail(), password: "correct-password", metadata: { prenom: "Auto", nom: "Mation" } });
    createdUserIds.push(signup.user!.id);
    await query(
      `insert into public.profiles (id, email, nom, prenom, role)
       values ($1, $2, 'Mation', 'Auto', 'etudiant')
       on conflict (id) do update set email = excluded.email`,
      [signup.user!.id, signup.user!.email]
    );

    const calls: unknown[] = [];
    process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.google.test/exec";
    process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET = "test-secret";
    globalThis.fetch = (async (_url, init) => {
      calls.push(JSON.parse(String(init?.body || "{}")));
      return Response.json({ ok: true });
    }) as typeof fetch;

    const warnings = await runRegistrationAutomation({
      email: signup.user!.email,
      id: signup.user!.id,
      nom: "Mation",
      prenom: "Auto",
      telephone: "07 65 43 21 09"
    });
    expect(warnings).toHaveLength(0);
    expect(calls).toHaveLength(2);
    expect(calls.some(call => Boolean((call as { welcomeRegistration?: unknown }).welcomeRegistration))).toBe(true);

    // La notification admin est composée côté application pour transporter tous
    // les champs collectés, sans dépendre d'une mise à jour du script Google.
    const notification = (calls[0] as { campaign?: { body?: string; subject?: string; to?: string } }).campaign;
    expect(notification?.subject).toBe("Nouvelle inscription — Auto Mation");
    expect(notification?.to || "").toContain("oeuvrecatholiquefrance@gmail.com");
    expect(notification?.body || "").toContain("07 65 43 21 09");
    expect(notification?.body || "").toContain(signup.user!.email);

    const outbox = await query<{ delivery_status: string }>(
      `select delivery_status from public.registration_notification_outbox where user_id = $1`,
      [signup.user!.id]
    );
    expect(outbox.rows[0]?.delivery_status).toBe("sent");

    const campaign = await query<{ attempt_count: number; delivery_status: string; sent_at: Date | null }>(
      `select attempt_count, delivery_status, sent_at from public.marketing_campaign_deliveries
       where profile_id = $1 and campaign_key = 'mandatory-registration-onboarding'`,
      [signup.user!.id]
    );
    expect(campaign.rows[0]?.delivery_status).toBe("pending");
    expect(campaign.rows[0]?.attempt_count).toBe(0);
    expect(campaign.rows[0]?.sent_at).toBeNull();
  });

  it("falls back to the designed welcome campaign when Apps Script does not support welcomeRegistration yet", async () => {
    const signup = await createVerifiedUser({ email: testEmail(), password: "correct-password", metadata: { prenom: "Design", nom: "Mail" } });
    createdUserIds.push(signup.user!.id);
    await query(
      `insert into public.profiles (id, email, nom, prenom, role)
       values ($1, $2, 'Mail', 'Design', 'etudiant')
       on conflict (id) do update set email = excluded.email`,
      [signup.user!.id, signup.user!.email]
    );

    const calls: unknown[] = [];
    process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.google.test/exec";
    process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET = "test-secret";
    globalThis.fetch = (async (_url, init) => {
      const payload = JSON.parse(String(init?.body || "{}"));
      calls.push(payload);
      if (payload.welcomeRegistration) {
        return Response.json({ ok: false, error: "Unsupported payload" }, { status: 200 });
      }
      return Response.json({ ok: true });
    }) as typeof fetch;

    const warnings = await runRegistrationAutomation({
      email: signup.user!.email,
      id: signup.user!.id,
      nom: "Mail",
      prenom: "Design"
    });

    expect(warnings).toHaveLength(0);
    expect(calls).toHaveLength(3);
    expect(Boolean((calls[1] as { welcomeRegistration?: unknown }).welcomeRegistration)).toBe(true);

    const fallbackWelcome = (calls[2] as { campaign?: { htmlBody?: string; subject?: string } }).campaign;
    expect(fallbackWelcome?.subject).toBe("Bienvenue à l’Institut Saint Irénée");
    expect(fallbackWelcome?.htmlBody || "").toContain("Institut Saint Irénée");
    expect(fallbackWelcome?.htmlBody || "").toContain("Accéder au site");
  });

  it("records failed registration automation without throwing", async () => {
    const signup = await createVerifiedUser({ email: testEmail(), password: "correct-password" });
    createdUserIds.push(signup.user!.id);
    await query(
      `insert into public.profiles (id, email, nom, prenom, role)
       values ($1, $2, 'Failure', 'Script', 'etudiant')
       on conflict (id) do update set email = excluded.email`,
      [signup.user!.id, signup.user!.email]
    );

    process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.google.test/exec";
    process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET = "test-secret";
    globalThis.fetch = (async () => Response.json({ ok: false, error: "quota reached" }, { status: 200 })) as typeof fetch;

    const warnings = await runRegistrationAutomation({
      email: signup.user!.email,
      id: signup.user!.id,
      nom: "Failure",
      prenom: "Script"
    });
    expect(warnings.length).toBeGreaterThanOrEqual(2);

    const outbox = await query<{ delivery_status: string; last_error: string }>(
      `select delivery_status, last_error from public.registration_notification_outbox where user_id = $1`,
      [signup.user!.id]
    );
    expect(outbox.rows[0]?.delivery_status).toBe("failed");
    expect(outbox.rows[0]?.last_error).toContain("quota reached");
  });
});
