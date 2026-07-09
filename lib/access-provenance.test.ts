import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("access provenance migration backfills pass-window enrollments with an expiry", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260709010000_access_provenance.sql"),
    "utf8"
  );
  assert.match(migration, /access_source/i);
  assert.match(migration, /access_expires_at/i);
  assert.match(migration, /annual_access_passes/i);
  assert.match(migration, /module_progress/i);
  assert.match(migration, /date_debut/i);
  assert.match(migration, /starts_at/i);
  assert.match(migration, /expires_at/i);
  assert.match(migration, /enrollment\.access_source <> 'payment'/i);
  assert.match(migration, /column_name = 'payment_order_id'/i);
});

test("payment reversal migration links historical paid course enrollments", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260709050000_payment_reversals.sql"),
    "utf8"
  );
  assert.match(migration, /ranked_paid_orders/i);
  assert.match(migration, /product_type\s*=\s*'legacy_course'/i);
  assert.match(migration, /status in \('completed', 'partially_refunded'\)/i);
  assert.match(migration, /access_source\s*=\s*'payment'/i);
  assert.match(migration, /payment_order_id\s*=\s*purchase\.order_id/i);
  assert.match(migration, /enrollment\.access_source = 'legacy'/i);
  assert.match(migration, /enrollment\.payment_order_id is null/i);
  assert.match(migration, /enrollment\.created_at >= purchase\.order_updated_at - interval '5 minutes'/i);
});
