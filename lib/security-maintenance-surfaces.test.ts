import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("security retention is explicit, transactional and protected by an exact database guard", () => {
  const source = readFileSync(join(process.cwd(), "scripts/security-maintenance.ts"), "utf8");
  assert.match(source, /databaseName !== expectedDatabase/);
  assert.match(source, /withTransaction\(async client/);
  assert.match(source, /password_reset_tokens/);
  assert.match(source, /security_rate_limits/);
  assert.match(source, /730 days/);
  assert.doesNotMatch(source, /truncate\s/i);
});
