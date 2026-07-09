import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("database migrations require an exact target, immutable checksums and one atomic ledger", () => {
  const script = readFileSync("scripts/apply-database-migrations.ts", "utf8");
  assert.match(script, /MIGRATION_DATABASE/);
  assert.match(script, /databaseName !== expectedDatabase/);
  assert.match(script, /--baseline-through=/);
  assert.match(script, /createHash\("sha256"\)/);
  assert.match(script, /already registered|déjà enregistrée/i);
  assert.match(script, /pg_advisory_xact_lock/);
  assert.match(script, /begin/);
  assert.match(script, /commit/);
  assert.match(script, /rollback/);
  assert.match(script, /irenee_ops\.schema_migrations/);
  assert.match(script, /revoke all on schema irenee_ops from public/i);
});
