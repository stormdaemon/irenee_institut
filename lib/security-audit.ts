import { createHmac } from "node:crypto";
import { query } from "@/lib/db";
import { getTrustedClientIp } from "@/lib/request-security";

const allowedMetadataKeys = new Set(["reason", "route", "subject_hash"]);

function keyedHash(value: string) {
  const key = process.env.AUDIT_LOG_PEPPER || process.env.LOCAL_AUTH_JWT_SECRET || "";
  if (key.length < 32 || !value) return null;
  return createHmac("sha256", key).update(value).digest("hex");
}

export function hashAuditSubject(value: string) {
  return keyedHash(value.trim().toLowerCase()) || "";
}

export async function recordSecurityEvent(input: {
  actorUserId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  if (!/^[a-z0-9_.-]{3,80}$/.test(input.eventType)) return;
  const metadata = Object.fromEntries(
    Object.entries(input.metadata || {})
      .filter(([key]) => allowedMetadataKeys.has(key))
      .map(([key, value]) => [key, String(value).slice(0, 300)])
  );
  const ip = input.request ? getTrustedClientIp(input.request) : "";
  await query(
    `insert into public.security_audit_events (event_type,actor_user_id,ip_hash,metadata)
     values ($1,$2,$3,$4::jsonb)`,
    [input.eventType, input.actorUserId || null, keyedHash(ip), JSON.stringify(metadata)]
  ).catch(error => {
    console.error("security_audit_write_failed", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error)
    });
  });
}
