import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("password reset schema and service enforce one-time server-side credentials", () => {
  const migration = source("supabase/migrations/20260709060000_password_reset.sql");
  const service = source("lib/password-reset.ts");

  assert.match(migration, /create table if not exists public\.password_reset_tokens/);
  assert.match(migration, /length\(token_hash\) = 64/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.password_reset_tokens from public, anon, authenticated/);
  assert.match(service, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(service, /expires_at > now\(\)/);
  assert.match(service, /update public\.app_sessions/);
  assert.match(service, /update public\.email_verification_tokens/);
  assert.match(service, /\[row\.id, hashToken\(resetToken\), PASSWORD_RESET_TTL_SECONDS\]/);
  assert.doesNotMatch(service, /\[row\.id, resetToken, PASSWORD_RESET_TTL_SECONDS\]/);
});

test("password reset endpoints are bounded, same-origin, generic and hierarchically rate limited", () => {
  const requestRoute = source("app/api/auth/password/reset/request/route.ts");
  const completeRoute = source("app/api/auth/password/reset/complete/route.ts");

  for (const route of [requestRoute, completeRoute]) {
    assert.match(route, /assertSameOrigin\(request\)/);
    assert.match(route, /readJsonBodyWithLimit/);
    assert.match(route, /checkRateLimitHierarchy/);
    assert.match(route, /"Cache-Control": "no-store"/);
  }
  assert.match(requestRoute, /Si un compte actif correspond à cette adresse/);
  assert.doesNotMatch(requestRoute, /console\.error\([^\n]*error/);
  assert.match(completeRoute, /reauthenticationRequired: true/);
  assert.doesNotMatch(completeRoute, /setSessionCookie/);
});

test("password reset surfaces keep the credential out of query strings and expose accessible mobile forms", () => {
  const resetPage = source("app/auth/password-reset/page.tsx");
  const forgotPage = source("app/auth/password-forgot/page.tsx");
  const loginPage = source("app/auth/login/page.tsx");
  const mailer = source("lib/google-apps-script.ts");

  assert.match(resetPage, /new URLSearchParams\(url\.hash\.slice\(1\)\)/);
  assert.match(resetPage, /window\.history\.replaceState/);
  assert.doesNotMatch(resetPage, /searchParams\.get\(["']code["']\)/);
  assert.match(forgotPage, /htmlFor="password-reset-email"/);
  assert.match(forgotPage, /inputMode="email"/);
  assert.match(loginPage, /href="\/auth\/password-forgot"/);
  assert.match(mailer, /resetUrl\.hash = new URLSearchParams/);
  assert.doesNotMatch(mailer, /resetUrl\.searchParams\.set\(["']code["']/);
});
