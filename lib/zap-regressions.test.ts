import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security-headers";
import { proxy } from "../proxy";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("HTML CSP confines inline CSS to attributes instead of style elements", () => {
  const csp = buildContentSecurityPolicy("test-nonce", false, true);

  assert.match(csp, /style-src 'self' 'nonce-test-nonce'/);
  assert.match(csp, /style-src-elem 'self' 'nonce-test-nonce'/);
  assert.match(csp, /style-src-attr 'unsafe-inline'/);
  assert.doesNotMatch(csp, /style-src 'self' 'unsafe-inline'/);
});

test("proxy removes sensitive login query data and short-circuits anonymous admin redirects", () => {
  const proxy = source("proxy.ts");

  assert.match(proxy, /SENSITIVE_LOGIN_QUERY_PARAMETERS/);
  assert.match(proxy, /request\.nextUrl\.pathname\.startsWith\("\/admin"\)/);
  assert.match(proxy, /__Host-irenee_session/);
  assert.match(proxy, /irenee_session/);
});

test("proxy canonicalizes scanner payloads without changing the valid checkout", async () => {
  const invalidCheckout = proxy(new NextRequest("https://irenee-institut.org/formations?checkout=annual-pass%27%20OR%20%271%27=%271"));
  assert.equal(invalidCheckout.status, 307);
  assert.equal(invalidCheckout.headers.get("location"), "https://irenee-institut.org/formations");
  assert.equal((await invalidCheckout.text()).length, 0);

  const sensitiveLogin = proxy(new NextRequest("https://irenee-institut.org/auth/login?email=a%40example.test&password=secret&next=%2Fadmin"));
  assert.equal(sensitiveLogin.status, 302);
  assert.equal(sensitiveLogin.headers.get("location"), "https://irenee-institut.org/auth/login?next=%2Fadmin");
  assert.equal((await sensitiveLogin.text()).length, 0);

  const anonymousAdmin = proxy(new NextRequest("https://irenee-institut.org/admin"));
  assert.equal(anonymousAdmin.status, 307);
  assert.equal(anonymousAdmin.headers.get("location"), "https://irenee-institut.org/auth/login?next=%2Fadmin");
  assert.equal((await anonymousAdmin.text()).length, 0);

  const validCheckout = proxy(new NextRequest("https://irenee-institut.org/formations?checkout=annual-pass"));
  assert.equal(validCheckout.headers.get("x-middleware-next"), "1");
});

test("Nginx serves uniform security-complete rate-limit and API-root errors", () => {
  const nginx = source("ops/nginx/irenee-production.conf");

  assert.match(nginx, /error_page 429 = @irenee_rate_limited/);
  assert.match(nginx, /location @irenee_rate_limited/);
  assert.match(nginx, /default_type application\/json/);
  assert.match(nginx, /Content-Security-Policy "default-src 'none'/);
  assert.match(nginx, /location = \/api\/ \{/);
  assert.match(nginx, /return 404 '\{"error":"Route API introuvable\."\}'/);
});
