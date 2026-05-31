import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("admin pages require a director session", () => {
  assert.match(source("app/admin/layout.tsx"), /requireDirectorSession/);
});

for (const route of [
  "app/api/users/route.ts",
  "app/api/users/[id]/route.ts",
  "app/api/courses/[id]/route.ts",
  "app/api/homework/route.ts",
  "app/api/homework/[id]/route.ts",
  "app/api/settings/route.ts",
  "app/api/payments/[id]/route.ts",
  "app/api/book-requests/[id]/route.ts",
  "app/api/payments/paypal/test/route.ts"
]) {
  test(`${route} requires director authorization`, () => {
    assert.match(source(route), /authorizeDirector/);
  });
}

test("the public courses endpoint serializes a public catalog", () => {
  const route = source("app/api/courses/route.ts");
  assert.match(route, /toPublicCourse/);
  assert.match(route, /authorizeDirector/);
});

test("registration and avatar updates authenticate the account owner", () => {
  assert.match(source("app/api/inscription/route.ts"), /authorizeBearerUser/);
  assert.match(source("app/api/profile/avatar/route.ts"), /authorizeBearerUser/);
});
