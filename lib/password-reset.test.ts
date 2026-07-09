import assert from "node:assert/strict";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { POST as completePasswordReset } from "../app/api/auth/password/reset/complete/route";
import { POST as requestPasswordReset } from "../app/api/auth/password/reset/request/route";
import { query } from "./db";
import { beginEmailSignUp, signInWithPassword, verifyAccessToken, verifyEmailToken } from "./local-auth";
import { issuePasswordResetToken, resetPasswordWithToken } from "./password-reset";

if (!process.env.LOCAL_AUTH_JWT_SECRET) {
  process.env.LOCAL_AUTH_JWT_SECRET = "isolated-password-reset-secret-with-at-least-32-characters";
}

const createdUserIds: string[] = [];
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const originalAppsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
const originalAppsScriptSecret = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET;

function uniqueTestIp() {
  return `203.0.${randomInt(1, 255)}.${randomInt(1, 255)}`;
}

function sameOriginRequest(path: string, body: Record<string, unknown>, ip = uniqueTestIp()) {
  return new Request(`https://irenee.test${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      origin: "https://irenee.test",
      "sec-fetch-site": "same-origin",
      "x-real-ip": ip
    },
    method: "POST"
  });
}

async function createConfirmedUser(prefix: string) {
  const email = `${prefix}-${randomUUID()}@example.test`;
  const signup = await beginEmailSignUp({
    email,
    metadata: { nom: "Réinitialisation", prenom: "Test" }
  });
  assert.ok(signup.user && signup.verificationToken);
  createdUserIds.push(signup.user.id);
  const verified = await verifyEmailToken(signup.verificationToken, "ancienne-phrase-de-passe-2026");
  assert.ok(verified.session);
  return { email, signup, verified };
}

beforeEach(async () => {
  const database = await query<{ name: string }>("select current_database() as name");
  assert.match(database.rows[0]?.name || "", /security_test/, "password reset tests must use the isolated database");
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
  if (originalAppsScriptUrl === undefined) delete process.env.GOOGLE_APPS_SCRIPT_URL;
  else process.env.GOOGLE_APPS_SCRIPT_URL = originalAppsScriptUrl;
  if (originalAppsScriptSecret === undefined) delete process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET;
  else process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET = originalAppsScriptSecret;
  while (createdUserIds.length) {
    await query("delete from auth.users where id = $1", [createdUserIds.pop()]);
  }
});

test("password reset tokens are hashed, expirable, single-use and superseded by a newer request", async () => {
  const { email, signup } = await createConfirmedUser("password-reset-token");

  const first = await issuePasswordResetToken(email);
  assert.equal(first.user?.id, signup.user!.id);
  assert.equal(typeof first.resetToken, "string");
  const stored = await query<{ token_hash: string }>(
    "select token_hash from public.password_reset_tokens where user_id = $1 and consumed_at is null",
    [signup.user!.id]
  );
  assert.equal(stored.rows.length, 1);
  assert.equal(stored.rows[0]?.token_hash.length, 64);
  assert.notEqual(stored.rows[0]?.token_hash, first.resetToken);

  const replacement = await issuePasswordResetToken(email);
  assert.ok(replacement.resetToken);
  assert.equal((await resetPasswordWithToken(first.resetToken!, "nouvelle-phrase-de-passe-2026")).error?.message,
    "Lien de réinitialisation invalide ou expiré.");

  await query(
    `update public.password_reset_tokens
     set created_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute'
     where token_hash = $1`,
    [createHash("sha256").update(replacement.resetToken!).digest("hex")]
  );
  assert.match(
    (await resetPasswordWithToken(replacement.resetToken!, "nouvelle-phrase-de-passe-2026")).error?.message || "",
    /invalide ou expiré/i
  );
});

test("a successful reset atomically changes the password and invalidates all sessions and account tokens", async () => {
  const { email, signup, verified } = await createConfirmedUser("password-reset-success");
  const secondSession = await signInWithPassword(email, "ancienne-phrase-de-passe-2026");
  assert.ok(secondSession.session);
  const reset = await issuePasswordResetToken(email);
  assert.ok(reset.resetToken);

  const [firstAttempt, replay] = await Promise.all([
    resetPasswordWithToken(reset.resetToken!, "nouvelle-phrase-de-passe-2026"),
    resetPasswordWithToken(reset.resetToken!, "autre-phrase-de-passe-solide-2026")
  ]);
  const outcomes = [firstAttempt, replay];
  assert.equal(outcomes.filter(result => result.error === null).length, 1);
  assert.equal(outcomes.filter(result => result.error !== null).length, 1);
  const winningPassword = firstAttempt.error === null
    ? "nouvelle-phrase-de-passe-2026"
    : "autre-phrase-de-passe-solide-2026";

  assert.equal((await verifyAccessToken(verified.session!.access_token)).user, null);
  assert.equal((await verifyAccessToken(secondSession.session!.access_token)).user, null);
  assert.equal((await signInWithPassword(email, "ancienne-phrase-de-passe-2026")).session, null);
  assert.ok((await signInWithPassword(email, winningPassword)).session);

  const activeTokens = await query<{ reset: string; verification: string }>(
    `select
       (select count(*)::text from public.password_reset_tokens where user_id = $1 and consumed_at is null) as reset,
       (select count(*)::text from public.email_verification_tokens where user_id = $1 and consumed_at is null) as verification`,
    [signup.user!.id]
  );
  assert.equal(activeTokens.rows[0]?.reset, "0");
  assert.equal(activeTokens.rows[0]?.verification, "0");
});

test("password reset request responses do not enumerate accounts and the emailed secret stays out of URLs and logs", async () => {
  const { email } = await createConfirmedUser("password-reset-request");
  process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.google.test/password-reset";
  process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET = "test-mail-secret";
  let deliveredToken = "";
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => { logged.push(args); };
  globalThis.fetch = async (_input, init) => {
    const payload = JSON.parse(String(init?.body || "{}"));
    const body = String(payload.campaign?.body || "");
    const link = body.match(/https:\/\/[^\s]+/)?.[0] || "";
    assert.ok(link);
    assert.doesNotMatch(link, /[?&]code=/);
    deliveredToken = new URL(link).hash.match(/(?:^#|&)code=([^&]+)/)?.[1] || "";
    return Response.json({ ok: false, error: `delivery failed ${deliveredToken}` }, { status: 502 });
  };

  const existingResponse = await requestPasswordReset(sameOriginRequest(
    "/api/auth/password/reset/request",
    { email },
    uniqueTestIp()
  ));
  const missingResponse = await requestPasswordReset(sameOriginRequest(
    "/api/auth/password/reset/request",
    { email: `missing-${randomUUID()}@example.test` },
    uniqueTestIp()
  ));
  assert.equal(existingResponse.status, 202);
  assert.equal(missingResponse.status, 202);
  assert.deepEqual(await existingResponse.json(), await missingResponse.json());
  assert.ok(deliveredToken.length >= 32);
  assert.doesNotMatch(JSON.stringify(logged), new RegExp(deliveredToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("password reset completion is same-origin, validates passwords and never creates a session", async () => {
  const { email } = await createConfirmedUser("password-reset-route");
  const reset = await issuePasswordResetToken(email);
  assert.ok(reset.resetToken);

  const mismatch = await completePasswordReset(sameOriginRequest("/api/auth/password/reset/complete", {
    code: reset.resetToken,
    password: "nouvelle-phrase-de-passe-2026",
    passwordConfirmation: "phrase-differente-et-solide-2026"
  }));
  assert.equal(mismatch.status, 400);

  const success = await completePasswordReset(sameOriginRequest("/api/auth/password/reset/complete", {
    code: reset.resetToken,
    password: "nouvelle-phrase-de-passe-2026",
    passwordConfirmation: "nouvelle-phrase-de-passe-2026"
  }));
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { ok: true, reauthenticationRequired: true });
  assert.equal(success.headers.get("Cache-Control"), "no-store");
  assert.equal(success.headers.get("set-cookie"), null);
  assert.ok((await signInWithPassword(email, "nouvelle-phrase-de-passe-2026")).session);

  const replay = await completePasswordReset(sameOriginRequest("/api/auth/password/reset/complete", {
    code: reset.resetToken,
    password: "encore-une-phrase-de-passe-2026",
    passwordConfirmation: "encore-une-phrase-de-passe-2026"
  }));
  assert.equal(replay.status, 400);
  assert.deepEqual(await replay.json(), { error: "Lien de réinitialisation invalide ou expiré." });
});
