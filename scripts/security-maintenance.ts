import { getPool, query, withTransaction } from "@/lib/db";

async function main() {
  const apply = process.argv.includes("--apply");
  const expectedDatabase = process.env.SECURITY_MAINTENANCE_DATABASE || "";
  const database = await query<{ name: string }>("select current_database() as name");
  const databaseName = database.rows[0]?.name || "";

  if (!apply) {
    console.info(`Mode contrôle uniquement sur ${databaseName}; ajoutez --apply pour exécuter la rétention.`);
    return;
  }
  if (!expectedDatabase || databaseName !== expectedDatabase) {
    throw new Error("SECURITY_MAINTENANCE_DATABASE doit correspondre exactement à la base ciblée.");
  }

  const statements = [
    ["sessions", `delete from public.app_sessions
    where expires_at < now() - interval '7 days'
       or revoked_at < now() - interval '30 days'`],
    ["email_verification_tokens", `delete from public.email_verification_tokens
    where expires_at < now() - interval '30 days'
       or consumed_at < now() - interval '30 days'`],
    ["password_reset_tokens", `delete from public.password_reset_tokens
    where expires_at < now() - interval '30 days'
       or consumed_at < now() - interval '30 days'`],
    ["rate_limits", `delete from public.security_rate_limits
    where reset_at < now() - interval '1 day'`],
    ["payment_events", `delete from public.payment_events
    where created_at < now() - interval '730 days'`],
    ["security_audit_events", `delete from public.security_audit_events
    where created_at < now() - interval '730 days'`]
  ] as const;

  const deleted = await withTransaction(async client => {
    const counts: Array<[string, number]> = [];
    for (const [label, sql] of statements) {
      const result = await client.query(sql);
      counts.push([label, result.rowCount || 0]);
    }
    return counts;
  });
  for (const [label, count] of deleted) console.info(`${label}: ${count} ligne(s) expirée(s) supprimée(s).`);
}

try {
  await main();
} finally {
  await getPool().end();
}
