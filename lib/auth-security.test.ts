import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { decodeJwt } from "jose";
import { authenticateRequest } from "./api-auth";
import { POST as changePasswordRoute } from "../app/api/auth/password/route";
import { POST as resendVerification } from "../app/api/auth/verification/resend/route";
import { query } from "./db";
import {
  beginEmailSignUp,
  changePassword,
  issueEmailVerificationToken,
  revokeAccessToken,
  signInWithPassword,
  validatePassword,
  verifyAccessToken,
  verifyEmailToken
} from "./local-auth";

if (!process.env.LOCAL_AUTH_JWT_SECRET) {
  process.env.LOCAL_AUTH_JWT_SECRET = "isolated-auth-test-secret-with-at-least-32-characters";
}

const createdUserIds: string[] = [];
const originalFetch = globalThis.fetch;
const originalAppsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
const originalAppsScriptSecret = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET;

function uniqueTestIp() {
  return `198.51.${randomInt(1, 255)}.${randomInt(1, 255)}`;
}

beforeEach(async () => {
  const database = await query<{ name: string }>("select current_database() as name");
  assert.match(database.rows[0]?.name || "", /security_test/, "auth security tests must use the isolated database");
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  if (originalAppsScriptUrl === undefined) delete process.env.GOOGLE_APPS_SCRIPT_URL;
  else process.env.GOOGLE_APPS_SCRIPT_URL = originalAppsScriptUrl;
  if (originalAppsScriptSecret === undefined) delete process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET;
  else process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET = originalAppsScriptSecret;
  while (createdUserIds.length) {
    await query("delete from auth.users where id = $1", [createdUserIds.pop()]);
  }
});

test("email verification gates login and creates a server-revocable session", async () => {
  const email = `verified-${randomUUID()}@example.test`;
  const signup = await beginEmailSignUp({
    email,
    metadata: { nom: "Sécurité", prenom: "Test" }
  });
  createdUserIds.push(signup.user!.id);

  assert.equal(signup.session, null);
  assert.equal(typeof signup.verificationToken, "string");
  assert.equal((await signInWithPassword(email, "a-long-correct-password")).session, null);

  const verified = await verifyEmailToken(signup.verificationToken!, "a-long-correct-password");
  assert.ok(verified.session?.access_token);
  const claims = decodeJwt(verified.session!.access_token);
  assert.equal(claims.iss, "https://irenee-institut.org");
  assert.equal(claims.aud, "irenee-web");
  assert.equal(typeof claims.jti, "string");

  const sessionRows = await query<{ count: string }>(
    "select count(*)::text as count from public.app_sessions where user_id = $1 and revoked_at is null",
    [signup.user!.id]
  );
  assert.equal(sessionRows.rows[0]?.count, "1");
  assert.ok((await verifyAccessToken(verified.session!.access_token)).user);

  await revokeAccessToken(verified.session!.access_token);
  assert.equal((await verifyAccessToken(verified.session!.access_token)).user, null);
});

test("cookie authentication works for reads and enforces same-origin on mutations", async () => {
  const signup = await beginEmailSignUp({
    email: `cookie-${randomUUID()}@example.test`,
    metadata: { nom: "Cookie", prenom: "Test" }
  });
  createdUserIds.push(signup.user!.id);
  const verified = await verifyEmailToken(signup.verificationToken!, "a-long-correct-password");
  const cookie = `irenee_session=${encodeURIComponent(verified.session!.access_token)}`;

  const read = await authenticateRequest(new Request("https://irenee.test/api/me", { headers: { cookie } }));
  assert.equal(read.ok, true);

  const missingOrigin = await authenticateRequest(new Request("https://irenee.test/api/profile/avatar", {
    headers: { cookie },
    method: "POST"
  }));
  assert.equal(missingOrigin.ok, false);
  if (!missingOrigin.ok) assert.equal(missingOrigin.response.status, 403);

  const sameOrigin = await authenticateRequest(new Request("https://irenee.test/api/profile/avatar", {
    headers: { cookie, origin: "https://irenee.test", "sec-fetch-site": "same-origin" },
    method: "POST"
  }));
  assert.equal(sameOrigin.ok, true);
});

test("password validation rejects weak, common and pathological inputs", () => {
  assert.throws(() => validatePassword("short"), /12 caractères/i);
  assert.throws(() => validatePassword("password1234"), /courant/i);
  assert.throws(() => validatePassword("x".repeat(129)), /128 caractères/i);
  assert.throws(() => validatePassword("x".repeat(73)), /72 octets/i);
  assert.doesNotThrow(() => validatePassword("une-phrase-longue-et-unique-2026"));
});

test("password change requires the current password and revokes every existing session", async () => {
  const email = `password-change-${randomUUID()}@example.test`;
  const signup = await beginEmailSignUp({
    email,
    metadata: { nom: "Sécurité", prenom: "Mot de passe" }
  });
  createdUserIds.push(signup.user!.id);
  const verified = await verifyEmailToken(signup.verificationToken!, "ancienne-phrase-de-passe-2026");
  const secondSession = await signInWithPassword(email, "ancienne-phrase-de-passe-2026");

  const denied = await changePassword(signup.user!.id, "mot-de-passe-incorrect", "nouvelle-phrase-de-passe-2026");
  assert.match(denied.error?.message || "", /actuel/i);
  assert.ok((await verifyAccessToken(verified.session!.access_token)).user);

  const changed = await changePassword(signup.user!.id, "ancienne-phrase-de-passe-2026", "nouvelle-phrase-de-passe-2026");
  assert.equal(changed.error, null);
  assert.equal((await verifyAccessToken(verified.session!.access_token)).user, null);
  assert.equal((await verifyAccessToken(secondSession.session!.access_token)).user, null);
  assert.equal((await signInWithPassword(email, "ancienne-phrase-de-passe-2026")).session, null);
  assert.ok((await signInWithPassword(email, "nouvelle-phrase-de-passe-2026")).session);
});

test("password change route enforces cookie CSRF checks and expires the browser session", async () => {
  const email = `password-route-${randomUUID()}@example.test`;
  const signup = await beginEmailSignUp({ email });
  createdUserIds.push(signup.user!.id);
  const verified = await verifyEmailToken(signup.verificationToken!, "ancienne-phrase-de-passe-2026");
  const token = verified.session!.access_token;

  const response = await changePasswordRoute(new Request("https://irenee.test/api/auth/password", {
    body: JSON.stringify({
      currentPassword: "ancienne-phrase-de-passe-2026",
      nextPassword: "nouvelle-phrase-de-passe-2026",
      passwordConfirmation: "nouvelle-phrase-de-passe-2026"
    }),
    headers: {
      "Content-Type": "application/json",
      cookie: `irenee_session=${encodeURIComponent(token)}`,
      origin: "https://irenee.test",
      "sec-fetch-site": "same-origin",
      "x-real-ip": uniqueTestIp()
    },
    method: "POST"
  }));

  assert.equal(response.status, 200);
  assert.equal((await response.json()).reauthenticationRequired, true);
  assert.match(response.headers.get("set-cookie") || "", /Max-Age=0/i);
  assert.equal((await verifyAccessToken(token)).user, null);
  assert.ok((await signInWithPassword(email, "nouvelle-phrase-de-passe-2026")).session);
});

test("issuing a new verification link preserves an earlier valid link until either one is consumed", async () => {
  const email = `verification-resend-${randomUUID()}@example.test`;
  const signup = await beginEmailSignUp({
    email,
    metadata: { nom: "Sécurité", prenom: "Email" }
  });
  createdUserIds.push(signup.user!.id);

  const replacement = await issueEmailVerificationToken(email);
  assert.equal(replacement.user?.email, email);
  assert.equal(typeof replacement.verificationToken, "string");
  assert.ok((await verifyEmailToken(signup.verificationToken!, "une-phrase-longue-et-unique-2026")).session);
  assert.equal((await verifyEmailToken(replacement.verificationToken!, "une-phrase-longue-et-unique-2026")).session, null);

  const confirmed = await issueEmailVerificationToken(email);
  assert.equal(confirmed.user, null);
  assert.equal(confirmed.verificationToken, null);
});

test("verification resend route returns indistinguishable responses and only emails unconfirmed accounts", async () => {
  const email = `verification-route-${randomUUID()}@example.test`;
  const signup = await beginEmailSignUp({
    email,
    metadata: { nom: "Nom stocké", prenom: "Prénom stocké" }
  });
  createdUserIds.push(signup.user!.id);

  let deliveredCode = "";
  process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.google.test/verification";
  process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET = "test-mail-secret";
  globalThis.fetch = async (_input, init) => {
    const payload = JSON.parse(String(init?.body || "{}"));
    const plainBody = String(payload.campaign?.body || "");
    const confirmationUrl = plainBody.match(/https:\/\/[^\s]+/)?.[0] || "";
    deliveredCode = confirmationUrl
      ? new URLSearchParams(new URL(confirmationUrl).hash.slice(1)).get("code") || ""
      : "";
    assert.doesNotMatch(confirmationUrl, /[?&]code=/);
    assert.match(plainBody, /Prénom stocké Nom stocké/);
    return Response.json({ ok: true });
  };

  const requestFor = (targetEmail: string) => new Request("https://irenee.test/api/auth/verification/resend", {
    body: JSON.stringify({ email: targetEmail, next: "/espace-etudiant" }),
    headers: {
      "Content-Type": "application/json",
      origin: "https://irenee.test",
      "sec-fetch-site": "same-origin",
      "x-real-ip": uniqueTestIp()
    },
    method: "POST"
  });

  const unconfirmedResponse = await resendVerification(requestFor(email));
  const missingResponse = await resendVerification(requestFor(`missing-${randomUUID()}@example.test`));
  assert.equal(unconfirmedResponse.status, 202);
  assert.equal(missingResponse.status, 202);
  assert.deepEqual(await unconfirmedResponse.json(), await missingResponse.json());
  assert.ok(deliveredCode);
  const activeTokens = await query<{ count: string }>(
    "select count(*)::text as count from public.email_verification_tokens where user_id = $1 and consumed_at is null and expires_at > now()",
    [signup.user!.id]
  );
  assert.equal(activeTokens.rows[0]?.count, "2");
  assert.ok((await verifyEmailToken(deliveredCode, "une-phrase-longue-et-unique-2026")).session);
  assert.equal((await verifyEmailToken(signup.verificationToken!, "une-phrase-longue-et-unique-2026")).session, null);
});

test("mailbox verification overwrites the placeholder so a pre-registrant cannot choose the victim's password", async () => {
  const email = `pre-hijack-${randomUUID()}@example.test`;
  const signup = await beginEmailSignUp({ email, metadata: { nom: "Victime", prenom: "Compte" } });
  createdUserIds.push(signup.user!.id);
  assert.ok(signup.verificationToken);

  assert.equal((await signInWithPassword(email, "mot-de-passe-choisi-par-attaquant-2026")).session, null);
  const verified = await verifyEmailToken(signup.verificationToken!, "phrase-choisie-par-proprietaire-2026");
  assert.ok(verified.session);
  assert.equal((await signInWithPassword(email, "mot-de-passe-choisi-par-attaquant-2026")).session, null);
  assert.ok((await signInWithPassword(email, "phrase-choisie-par-proprietaire-2026")).session);
});

test("banning a confirmed account immediately invalidates existing sessions and password login", async () => {
  const email = `banned-session-${randomUUID()}@example.test`;
  const signup = await beginEmailSignUp({ email });
  createdUserIds.push(signup.user!.id);
  const verified = await verifyEmailToken(signup.verificationToken!, "phrase-longue-pour-compte-banni-2026");
  assert.ok(verified.session?.access_token);

  await query(
    "update auth.users set banned_until = now() + interval '1 hour', updated_at = now() where id = $1",
    [signup.user!.id]
  );

  assert.equal((await verifyAccessToken(verified.session!.access_token)).user, null);
  assert.equal((await signInWithPassword(email, "phrase-longue-pour-compte-banni-2026")).session, null);
});

test("a banned unconfirmed account cannot consume an email verification token", async () => {
  const email = `banned-verification-${randomUUID()}@example.test`;
  const signup = await beginEmailSignUp({ email });
  createdUserIds.push(signup.user!.id);

  await query(
    "update auth.users set banned_until = now() + interval '1 hour', updated_at = now() where id = $1",
    [signup.user!.id]
  );

  const result = await verifyEmailToken(signup.verificationToken!, "phrase-longue-pour-activation-2026");
  assert.equal(result.session, null);
  assert.equal(result.user, null);
  const state = await query<{ email_confirmed_at: Date | null }>(
    "select email_confirmed_at from auth.users where id = $1",
    [signup.user!.id]
  );
  assert.equal(state.rows[0]?.email_confirmed_at, null);
});
