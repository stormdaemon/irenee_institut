import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSameOrigin,
  getTrustedClientIp,
  parseRequestCookies,
  safeInternalPath
} from "./request-security";

test("safeInternalPath accepts local navigation and rejects executable or external redirects", () => {
  assert.equal(safeInternalPath("/espace-etudiant?tab=cours", "/"), "/espace-etudiant?tab=cours");
  assert.equal(safeInternalPath("javascript:alert(1)", "/"), "/");
  assert.equal(safeInternalPath("https://evil.test/phish", "/"), "/");
  assert.equal(safeInternalPath("//evil.test/phish", "/"), "/");
  assert.equal(safeInternalPath("/\\evil.test", "/"), "/");
  assert.equal(safeInternalPath("/%2f%2fevil.test", "/"), "/");
  assert.equal(safeInternalPath("/auth/login\r\nX-Evil: yes", "/"), "/");
});

test("assertSameOrigin protects cookie-authenticated unsafe requests", () => {
  const valid = new Request("https://irenee-institut.org/api/settings", {
    headers: { host: "irenee-institut.org", origin: "https://irenee-institut.org" },
    method: "POST"
  });
  assert.doesNotThrow(() => assertSameOrigin(valid));

  const crossSite = new Request("https://irenee-institut.org/api/settings", {
    headers: { host: "irenee-institut.org", origin: "https://evil.test", "sec-fetch-site": "cross-site" },
    method: "POST"
  });
  assert.throws(() => assertSameOrigin(crossSite), /origine/i);

  const proxiedHttps = new Request("http://irenee-institut.org/api/settings", {
    headers: {
      host: "irenee-institut.org",
      origin: "https://irenee-institut.org",
      "sec-fetch-site": "same-origin",
      "x-forwarded-host": "irenee-institut.org",
      "x-forwarded-proto": "https",
      "x-real-ip": "198.51.100.42"
    },
    method: "POST"
  });
  assert.doesNotThrow(() => assertSameOrigin(proxiedHttps));

  const spoofedOrigin = new Request("http://irenee-institut.org/api/settings", {
    headers: {
      host: "irenee-institut.org",
      origin: "https://evil.test",
      "sec-fetch-site": "same-origin",
      "x-forwarded-host": "irenee-institut.org",
      "x-forwarded-proto": "https",
      "x-real-ip": "198.51.100.42"
    },
    method: "POST"
  });
  assert.throws(() => assertSameOrigin(spoofedOrigin), /origine/i);

  const injectedForwardedHost = new Request("http://irenee-institut.org/api/settings", {
    headers: {
      host: "irenee-institut.org",
      origin: "https://irenee-institut.org",
      "x-forwarded-host": "irenee-institut.org,evil.test",
      "x-forwarded-proto": "https",
      "x-real-ip": "198.51.100.42"
    },
    method: "POST"
  });
  assert.throws(() => assertSameOrigin(injectedForwardedHost), /origine/i);
});

test("getTrustedClientIp ignores attacker-controlled X-Forwarded-For entries", () => {
  const request = new Request("https://irenee-institut.org/api/auth/login", {
    headers: {
      "x-forwarded-for": "203.0.113.99, 198.51.100.10",
      "x-real-ip": "198.51.100.10"
    }
  });
  assert.equal(getTrustedClientIp(request), "198.51.100.10");
});

test("parseRequestCookies handles encoded values without accepting malformed pairs", () => {
  const request = new Request("https://irenee.test", {
    headers: { cookie: "theme=dark; irenee_session=abc.def%2Eghi; malformed" }
  });
  const cookies = parseRequestCookies(request);
  assert.equal(cookies.get("theme"), "dark");
  assert.equal(cookies.get("irenee_session"), "abc.def.ghi");
  assert.equal(cookies.has("malformed"), false);
});
