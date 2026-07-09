import { createHmac } from "node:crypto";
import { query } from "@/lib/db";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

let cleanupCounter = 0;

function hashKey(key: string) {
  const pepper = process.env.RATE_LIMIT_PEPPER || process.env.LOCAL_AUTH_JWT_SECRET || "";
  if (pepper.length < 32) throw new Error("Rate limit pepper is not securely configured.");
  return createHmac("sha256", pepper).update(key).digest("hex");
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
    throw new Error("Invalid rate limit configuration.");
  }

  try {
    const result = await query<{ request_count: number; reset_at: Date | string }>(
      `insert into public.security_rate_limits (key_hash,request_count,reset_at,updated_at)
       values ($1,1,now() + ($2 * interval '1 millisecond'),now())
       on conflict (key_hash) do update set
         request_count = case
           when public.security_rate_limits.reset_at <= now() then 1
           else least(public.security_rate_limits.request_count + 1, $3 + 1)
         end,
         reset_at = case
           when public.security_rate_limits.reset_at <= now() then now() + ($2 * interval '1 millisecond')
           else public.security_rate_limits.reset_at
         end,
         updated_at = now()
       returning request_count, reset_at`,
      [hashKey(key), Math.ceil(windowMs), limit]
    );
    const count = Number(result.rows[0]?.request_count || limit + 1);
    const resetAt = new Date(result.rows[0]?.reset_at || Date.now() + windowMs).getTime();

    cleanupCounter += 1;
    if (cleanupCounter % 100 === 0) {
      query("delete from public.security_rate_limits where reset_at < now() - interval '1 day'").catch(() => undefined);
    }

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
    };
  } catch (error) {
    console.error("rate_limit_backend_failed", { error: error instanceof Error ? error.message : String(error) });
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  }
}

/**
 * Checks a broad bucket before allocating a more specific one. This prevents
 * an attacker whose IP is already blocked from creating an unbounded number
 * of per-account rows by rotating arbitrary email addresses.
 */
export async function checkRateLimitHierarchy(
  broadRule: RateLimitRule,
  specificRule: RateLimitRule
): Promise<{ broad: RateLimitResult; specific: RateLimitResult | null }> {
  const broad = await checkRateLimit(broadRule.key, broadRule.limit, broadRule.windowMs);
  if (!broad.allowed) return { broad, specific: null };

  const specific = await checkRateLimit(specificRule.key, specificRule.limit, specificRule.windowMs);
  return { broad, specific };
}
