import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ContactInputError, parseContactInput } from "@/lib/contact";
import { POST as submitContact } from "@/app/api/contact/route";

if (!process.env.LOCAL_AUTH_JWT_SECRET) {
  process.env.LOCAL_AUTH_JWT_SECRET = "isolated-contact-test-secret-with-at-least-32-characters";
}

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const validContact = {
  email: "marie@example.test",
  message: "Bonjour, je souhaite recevoir des précisions sur la formation.",
  nom: "Durand",
  prenom: "Marie",
  sujet: "Formation",
  telephone: "+33 6 12 34 56 78",
  website: ""
};

test("contact input accepts only bounded public fields", () => {
  assert.deepEqual(parseContactInput(validContact), validContact);

  for (const invalid of [
    { ...validContact, email: "invalide" },
    { ...validContact, message: "trop court" },
    { ...validContact, message: "x".repeat(4_001) },
    { ...validContact, nom: "x".repeat(81) },
    { ...validContact, nom: "Durand\r\nBcc: victime@example.test" },
    { ...validContact, sujet: "Autre\r\nBcc: victime@example.test" },
    { ...validContact, telephone: "01 23 45\nBcc" }
  ]) {
    assert.throws(() => parseContactInput(invalid), ContactInputError);
  }
});

test("contact endpoint is same-origin, bounded and persistently rate limited before delivery", () => {
  const route = source("app/api/contact/route.ts");
  const originCheck = route.indexOf("assertSameOrigin(request)");
  const bodyRead = route.indexOf("await readJsonBodyWithLimit");
  const limiter = route.indexOf("await checkRateLimitHierarchy");
  const delivery = route.indexOf("await sendContactMessage");

  assert.ok(originCheck >= 0 && bodyRead > originCheck && limiter > bodyRead && delivery > limiter);
  assert.match(route, /contact:ip:/);
  assert.match(route, /contact:email:/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.match(route, /"Retry-After"/);
  assert.match(route, /status: 429/);
});

test("contact page no longer posts visitor data directly to a third party", () => {
  const page = source("app/contact/page.tsx");

  assert.doesNotMatch(page, /formspree\.io/i);
  assert.match(page, /fetch\("\/api\/contact"/);
  assert.match(page, /credentials: "same-origin"/);
  assert.match(page, /autoComplete="off"/);
});

function contactRequest(body: unknown, origin = "https://irenee.test") {
  return new Request("https://irenee.test/api/contact", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin,
      "sec-fetch-site": origin === "https://irenee.test" ? "same-origin" : "cross-site",
      "x-real-ip": "203.0.113.190"
    },
    method: "POST"
  });
}

test("contact endpoint rejects cross-origin and invalid messages without delivery", async () => {
  const crossOrigin = await submitContact(contactRequest(validContact, "https://attacker.example"));
  assert.equal(crossOrigin.status, 403);
  assert.equal(crossOrigin.headers.get("cache-control"), "no-store");

  const invalid = await submitContact(contactRequest({ ...validContact, message: "court" }));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get("cache-control"), "no-store");
});

test("contact endpoint silently discards the honeypot after the persistent limiter", async () => {
  const response = await submitContact(contactRequest({
    ...validContact,
    email: `honeypot-${crypto.randomUUID()}@example.test`,
    website: "https://spam.example"
  }));
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
});
