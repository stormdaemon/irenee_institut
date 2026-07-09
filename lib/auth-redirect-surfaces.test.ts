import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("authentication redirects share the strict internal-path validator", () => {
  for (const path of [
    "app/auth/login/page.tsx",
    "app/auth/signup/page.tsx",
    "app/auth/callback/page.tsx"
  ]) {
    const content = source(path);
    assert.match(content, /import\s*\{\s*safeInternalPath\s*\}\s*from\s*["']@\/lib\/request-security["']/);
    assert.match(content, /safeInternalPath\(/);
  }

  const callback = source("app/auth/callback/page.tsx");
  assert.doesNotMatch(callback, /window\.location\.replace\(next\)/);
  assert.match(callback, /url\.hash\.slice\(1\)/);
  assert.doesNotMatch(callback, /url\.searchParams\.get\(["']code["']\)/);

  const mailer = source("lib/google-apps-script.ts");
  assert.match(mailer, /confirmationUrl\.hash\s*=/);
  assert.doesNotMatch(mailer, /confirmationUrl\.searchParams\.set\(["']code["']/);
});
