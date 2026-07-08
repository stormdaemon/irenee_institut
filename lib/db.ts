import { createRequire } from "node:module";
import type { Pool as PgPool, QueryResult, QueryResultRow } from "pg";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const nodeRequire = createRequire(import.meta.url);
const { Pool } = nodeRequire("pg") as typeof import("pg");

let pool: PgPool | null = null;

function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

export function getDatabaseUrl() {
  loadLocalEnv();
  return process.env.DATABASE_URL || "";
}

export function hasDatabaseEnv() {
  return Boolean(getDatabaseUrl());
}

export function getPool() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: 30_000
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}
