import { rm } from "node:fs/promises";
import { Pool } from "pg";
import { E2E_DIRECTOR_EMAIL } from "./global-setup";

function isolatedDatabaseUrl() {
  const databaseUrl = new URL(process.env.DATABASE_URL || "");
  if (!/security_test/i.test(databaseUrl.pathname) || !["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname)) {
    throw new Error("E2E teardown refused: expected a local security_test database.");
  }
  return databaseUrl.toString();
}

export default async function globalTeardown() {
  const pool = new Pool({ connectionString: isolatedDatabaseUrl(), max: 1 });
  try {
    await pool.query("delete from auth.users where lower(email) = lower($1)", [E2E_DIRECTOR_EMAIL]);
  } finally {
    await pool.end();
    await rm("e2e/.auth", { force: true, recursive: true });
  }
}
