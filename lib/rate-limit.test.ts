import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { beforeEach, test } from "node:test";
import { checkRateLimit, checkRateLimitHierarchy } from "./rate-limit";
import { query } from "./db";

beforeEach(async () => {
  const database = await query<{ name: string }>("select current_database() as name");
  assert.match(database.rows[0]?.name || "", /security_test/, "rate limit tests must use the isolated database");
});

test("persistent rate limiting is atomic and fails closed after the configured budget", async () => {
  const key = `test:${randomUUID()}`;
  const first = await checkRateLimit(key, 2, 60_000);
  const second = await checkRateLimit(key, 2, 60_000);
  const third = await checkRateLimit(key, 2, 60_000);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfterSeconds >= 1);
});

test("persistent rate limiting resets expired buckets", async () => {
  const key = `test:${randomUUID()}`;
  assert.equal((await checkRateLimit(key, 1, 10)).allowed, true);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal((await checkRateLimit(key, 1, 10)).allowed, true);
});

test("hierarchical limiting does not allocate attacker-controlled child buckets once the broad bucket is blocked", async () => {
  const suffix = randomUUID();
  const broadKey = `hierarchy:ip:${suffix}`;
  const firstChildKey = `hierarchy:account:first-${suffix}@example.test`;
  const rotatedChildKey = `hierarchy:account:rotated-${suffix}@example.test`;

  const first = await checkRateLimitHierarchy(
    { key: broadKey, limit: 1, windowMs: 60_000 },
    { key: firstChildKey, limit: 5, windowMs: 60_000 }
  );
  assert.equal(first.broad.allowed, true);
  assert.equal(first.specific?.allowed, true);

  const blocked = await checkRateLimitHierarchy(
    { key: broadKey, limit: 1, windowMs: 60_000 },
    { key: rotatedChildKey, limit: 5, windowMs: 60_000 }
  );
  assert.equal(blocked.broad.allowed, false);
  assert.equal(blocked.specific, null);

  const pepper = process.env.RATE_LIMIT_PEPPER || process.env.LOCAL_AUTH_JWT_SECRET || "";
  const rotatedHash = createHmac("sha256", pepper).update(rotatedChildKey).digest("hex");
  const rotatedRows = await query<{ count: string }>(
    "select count(*)::text as count from public.security_rate_limits where key_hash = $1",
    [rotatedHash]
  );
  assert.equal(rotatedRows.rows[0]?.count, "0");
});
