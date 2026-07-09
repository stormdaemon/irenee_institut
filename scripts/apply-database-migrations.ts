import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "../lib/db";

type Migration = {
  checksum: string;
  filename: string;
  sql: string;
};

type LedgerRow = {
  checksum: string;
  filename: string;
};

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const baselineArgument = args.find(argument => argument.startsWith("--baseline-through="));
const baselineThrough = baselineArgument?.slice("--baseline-through=".length) || "";

function loadMigrations(): Migration[] {
  return readdirSync(migrationDirectory)
    .filter(filename => /^[0-9][0-9A-Za-z_-]*\.sql$/.test(filename))
    .sort((left, right) => left.localeCompare(right, "en"))
    .map(filename => {
      const sql = readFileSync(join(migrationDirectory, filename), "utf8");
      return {
        checksum: createHash("sha256").update(sql).digest("hex"),
        filename,
        sql
      };
    });
}

function validateLedger(migrations: Migration[], rows: LedgerRow[]) {
  const files = new Map(migrations.map(migration => [migration.filename, migration]));
  for (const row of rows) {
    const migration = files.get(row.filename);
    if (!migration) throw new Error(`La migration enregistrée ${row.filename} manque dans la release.`);
    if (migration.checksum !== row.checksum) {
      throw new Error(`La migration déjà enregistrée ${row.filename} a été modifiée.`);
    }
  }
}

async function auditOnly(migrations: Migration[], databaseName: string) {
  const pool = getPool();
  const ledger = await pool.query<{ ledger: string | null }>(
    "select to_regclass('irenee_ops.schema_migrations')::text as ledger"
  );
  if (!ledger.rows[0]?.ledger) {
    console.info(`Base ${databaseName}: registre absent; aucune écriture effectuée.`);
    return;
  }
  const rows = await pool.query<LedgerRow>(
    "select filename,checksum from irenee_ops.schema_migrations order by filename"
  );
  validateLedger(migrations, rows.rows);
  const applied = new Set(rows.rows.map(row => row.filename));
  const pending = migrations.filter(migration => !applied.has(migration.filename));
  console.info(`Base ${databaseName}: ${rows.rowCount} migration(s) enregistrée(s), ${pending.length} en attente.`);
  for (const migration of pending) console.info(`EN ATTENTE ${migration.filename}`);
}

async function applyMigrations(migrations: Migration[], databaseName: string) {
  const baselineIndex = baselineThrough
    ? migrations.findIndex(migration => migration.filename === baselineThrough)
    : -1;
  if (baselineThrough && baselineIndex < 0) throw new Error("La migration de baseline demandée est introuvable.");

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended('irenee:schema-migrations', 0))");
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '120s'");
    await client.query("create schema if not exists irenee_ops");
    await client.query("revoke all on schema irenee_ops from public");
    await client.query(
      `create table if not exists irenee_ops.schema_migrations (
         filename text primary key,
         checksum text not null check (length(checksum) = 64),
         application_mode text not null check (application_mode in ('baseline','applied')),
         applied_at timestamptz not null default now()
       )`
    );
    await client.query("revoke all on irenee_ops.schema_migrations from public");

    const existing = await client.query<LedgerRow>(
      "select filename,checksum from irenee_ops.schema_migrations order by filename"
    );
    if (existing.rowCount === 0) {
      if (!baselineThrough) {
        throw new Error("--baseline-through=<fichier.sql> est requis lors de l'initialisation contrôlée du registre.");
      }
      for (const migration of migrations.slice(0, baselineIndex + 1)) {
        await client.query(
          `insert into irenee_ops.schema_migrations (filename,checksum,application_mode)
           values ($1,$2,'baseline')`,
          [migration.filename, migration.checksum]
        );
      }
    } else {
      validateLedger(migrations, existing.rows);
      if (baselineThrough && !existing.rows.some(row => row.filename === baselineThrough)) {
        throw new Error("La baseline demandée ne correspond pas au registre existant.");
      }
    }

    const registered = await client.query<LedgerRow>(
      "select filename,checksum from irenee_ops.schema_migrations order by filename"
    );
    validateLedger(migrations, registered.rows);
    const applied = new Set(registered.rows.map(row => row.filename));
    const pending = migrations.filter(migration => !applied.has(migration.filename));

    for (const migration of pending) {
      console.info(`APPLICATION ${migration.filename}`);
      await client.query(migration.sql);
      await client.query(
        `insert into irenee_ops.schema_migrations (filename,checksum,application_mode)
         values ($1,$2,'applied')`,
        [migration.filename, migration.checksum]
      );
    }
    await client.query("commit");
    console.info(`Base ${databaseName}: ${pending.length} migration(s) appliquée(s) atomiquement.`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const expectedDatabase = String(process.env.MIGRATION_DATABASE || "").trim();
  if (!expectedDatabase || !/^[A-Za-z0-9_-]{1,63}$/.test(expectedDatabase)) {
    throw new Error("MIGRATION_DATABASE doit nommer exactement la base autorisée.");
  }
  const database = await getPool().query<{ name: string }>("select current_database() as name");
  const databaseName = database.rows[0]?.name || "";
  if (databaseName !== expectedDatabase) {
    throw new Error(`Base refusée: attendu ${expectedDatabase}, reçu ${databaseName || "inconnue"}.`);
  }

  const migrations = loadMigrations();
  if (!migrations.length) throw new Error("Aucune migration versionnée n'a été trouvée.");
  if (apply) await applyMigrations(migrations, databaseName);
  else await auditOnly(migrations, databaseName);
}

try {
  await main();
} finally {
  await getPool().end();
}
