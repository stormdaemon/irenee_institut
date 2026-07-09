import { getPool, query, withTransaction } from "../lib/db";
import {
  isEncryptedSettingValue,
  protectSettingValue,
  secretSettingKeys,
  unprotectSettingValue
} from "../lib/settings";

type SettingRow = { key: string; value: string };

async function main() {
  const databaseResult = await query<{ name: string }>("select current_database() as name");
  const databaseName = databaseResult.rows[0]?.name || "";
  const rows = await query<SettingRow>(
    "select key,value from public.system_settings where key = any($1::text[]) order by key",
    [[...secretSettingKeys]]
  );

  const legacyRows: SettingRow[] = [];
  for (const row of rows.rows) {
    if (isEncryptedSettingValue(row.value)) {
      unprotectSettingValue(row.key, row.value);
    } else if (row.value) {
      legacyRows.push(row);
    }
  }

  console.info(`Base ciblée: ${databaseName}. Secrets existants: ${rows.rowCount}. À chiffrer: ${legacyRows.length}.`);
  if (!process.argv.includes("--apply")) {
    console.info("Audit en lecture seule terminé. Ajoutez --apply et SETTINGS_REENCRYPTION_DATABASE pour appliquer.");
    return;
  }

  const explicitlyAuthorizedDatabase = String(process.env.SETTINGS_REENCRYPTION_DATABASE || "");
  if (!explicitlyAuthorizedDatabase || explicitlyAuthorizedDatabase !== databaseName) {
    throw new Error("SETTINGS_REENCRYPTION_DATABASE doit correspondre exactement à la base ciblée.");
  }

  await withTransaction(async client => {
    for (const row of legacyRows) {
      await client.query(
        "update public.system_settings set value = $1, updated_at = now() where key = $2 and value = $3",
        [protectSettingValue(row.key, row.value), row.key, row.value]
      );
    }
  });
  console.info(`${legacyRows.length} paramètre(s) secret(s) chiffré(s), sans journaliser leur contenu.`);
}

try {
  await main();
} finally {
  await getPool().end();
}
