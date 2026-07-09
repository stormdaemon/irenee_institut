import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("PostgreSQL functions default to no PUBLIC execution and use an explicit allow-list", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260709070000_function_execute_allowlist.sql"),
    "utf8"
  );
  const runtimeRole = readFileSync(join(process.cwd(), "ops/postgres/create-runtime-role.sql"), "utf8");
  assert.match(migration, /revoke execute on all functions in schema public from public/i);
  assert.match(migration, /alter default privileges[\s\S]*revoke execute on functions from public/i);
  assert.match(migration, /get_user_role\(\).*search_path = pg_catalog, public, auth/i);
  assert.match(migration, /to_regprocedure\('public\.get_user_role\(\)'\) is not null/i);
  assert.match(runtimeRole, /revoke execute on all functions in schema public from public/i);
  assert.match(runtimeRole, /revoke temporary on database :DBNAME from public/i);
  assert.match(runtimeRole, /to_regprocedure\('public\.get_user_role\(\)'\) is not null/i);
  assert.match(runtimeRole, /grant execute on function public\.validate_payment/);
  assert.match(runtimeRole, /grant execute on function public\.process_payment_reversal/);
});
