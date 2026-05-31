import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("admin course editing accepts staff while sensitive pages stay director-only", () => {
  assert.match(source("app/admin/layout.tsx"), /requireStaffSession/);
  assert.match(source("app/admin/page.tsx"), /requireDirectorSession/);
  for (const section of ["homework", "legal", "payments", "settings", "stats", "users"]) {
    assert.match(source(`app/admin/${section}/layout.tsx`), /DirectorOnlyLayout/);
  }
  assert.match(source("app/api/courses/route.ts"), /authorizeStaff/);
  assert.match(source("app/api/courses/[id]/route.ts"), /authorizeStaff/);
});

for (const route of [
  "app/api/users/route.ts",
  "app/api/users/[id]/route.ts",
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
  assert.match(route, /authorizeStaff/);
});

test("registration and avatar updates authenticate the account owner", () => {
  assert.match(source("app/api/inscription/route.ts"), /authorizeBearerUser/);
  assert.match(source("app/api/profile/avatar/route.ts"), /authorizeBearerUser/);
});

test("directors and trainers both receive free pedagogical access", () => {
  for (const path of ["supabase/security_hardening.sql", "supabase/schema.sql"]) {
    const sql = source(path);
    assert.match(sql, /profiles\.role in \('directeur', 'formateur'\)/);
  }
});
