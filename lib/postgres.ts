import { query, hasDatabaseEnv } from "./db";
import { verifyAccessToken, deleteLocalUser } from "./local-auth";
import schema from "@/database/schema-columns.json";

type Cardinality = "many" | "one" | "optional" | "none" | "count" | "scalar";
type Row = Record<string, any>;
export type SqlResult<T = any> = { data: T | null; error: { message: string } | null; count?: number };
type WriteOptions = { returning?: Cardinality; columns?: string; conflict?: string[] };
const columnsByTable = schema as Record<string, Record<string, string>>;

function failure(error: unknown): SqlResult {
  return { data: null, error: { message: error instanceof Error ? error.message : "PostgreSQL operation failed." } };
}

function shape(rows: Row[], mode: Cardinality): SqlResult {
  if (mode === "none") return { data: null, error: null };
  if (mode === "count") return { data: null, count: Number(rows[0]?.count || 0), error: null };
  if (mode === "scalar") return { data: rows[0]?.result ?? null, error: null };
  if (mode === "one" && rows.length !== 1) return failure(new Error(rows.length ? "Multiple rows returned." : "Row not found."));
  if (mode === "optional" && rows.length > 1) return failure(new Error("Multiple rows returned."));
  return { data: mode === "one" || mode === "optional" ? rows[0] ?? null : rows, error: null };
}

/** Execute explicit, parameterized PostgreSQL. No query DSL or remote RPC. */
export function pgRead<T extends Row = Row>(sql: string, values?: unknown[], mode?: "many"): Promise<SqlResult<T[]>>;
export function pgRead<T extends Row = Row>(sql: string, values: unknown[], mode: "one" | "optional"): Promise<SqlResult<T>>;
export function pgRead(sql: string, values: unknown[], mode: Cardinality): Promise<SqlResult>;
export async function pgRead(sql: string, values: unknown[] = [], mode: Cardinality = "many"): Promise<SqlResult> {
  try { return shape((await query(sql, values)).rows, mode); }
  catch (error) { return failure(error); }
}

function identifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error("Invalid SQL identifier.");
  return `"${value}"`;
}

function checkedColumns(table: string, rows: Row[]) {
  if (!Object.hasOwn(columnsByTable, table)) throw new Error("Unknown PostgreSQL table.");
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  if (!columns.length || columns.some(column => !Object.hasOwn(columnsByTable[table], column))) throw new Error("Unknown PostgreSQL column.");
  return columns;
}

function encode(table: string, column: string, value: unknown) {
  return value != null && ["json", "jsonb"].includes(columnsByTable[table][column]) ? JSON.stringify(value) : value ?? null;
}

function projection(table: string, columns = "*") {
  if (columns === "*") return "*";
  return columns.split(",").map(column => {
    const name = column.trim();
    if (!Object.hasOwn(columnsByTable[table], name)) throw new Error("Unknown returning column.");
    return identifier(name);
  }).join(", ");
}

export async function pgInsert(table: string, payload: Row | Row[], options: WriteOptions = {}): Promise<SqlResult> {
  try {
    const rows = Array.isArray(payload) ? payload : [payload];
    if (!rows.length) return { data: null, error: null };
    const columns = checkedColumns(table, rows);
    const values: unknown[] = [];
    const tuples = rows.map(row => `(${columns.map(column => { values.push(encode(table, column, row[column])); return `$${values.length}`; }).join(", ")})`);
    let sql = `insert into public.${identifier(table)} (${columns.map(identifier).join(", ")}) values ${tuples.join(", ")}`;
    if (options.conflict) {
      if (!options.conflict.length || options.conflict.some(column => !Object.hasOwn(columnsByTable[table], column))) throw new Error("Invalid conflict target.");
      const updates = columns.filter(column => !options.conflict!.includes(column));
      sql += ` on conflict (${options.conflict.map(identifier).join(", ")}) ${updates.length ? `do update set ${updates.map(column => `${identifier(column)} = excluded.${identifier(column)}`).join(", ")}` : "do nothing"}`;
    }
    if (options.returning && options.returning !== "none") sql += ` returning ${projection(table, options.columns)}`;
    return await pgRead(sql, values, options.returning || "none");
  } catch (error) { return failure(error); }
}

/** whereSql is a developer-authored SQL fragment; values remain bound parameters. */
export async function pgUpdate(table: string, payload: Row, whereSql: string, whereValues: unknown[], options: WriteOptions = {}): Promise<SqlResult> {
  try {
    const columns = checkedColumns(table, [payload]);
    if (!whereSql.trim()) throw new Error("An explicit update predicate is required.");
    const values = columns.map(column => encode(table, column, payload[column]));
    const predicate = whereSql.replace(/\$(\d+)/g, (_, n: string) => `$${Number(n) + values.length}`);
    const sql = `update public.${identifier(table)} as t set ${columns.map((column, index) => `${identifier(column)} = $${index + 1}`).join(", ")} where ${predicate}${options.returning && options.returning !== "none" ? ` returning ${projection(table, options.columns)}` : ""}`;
    return await pgRead(sql, [...values, ...whereValues], options.returning || "none");
  } catch (error) { return failure(error); }
}

/** Local request services; authentication and SQL have separate implementations. */
export function createServerContext() {
  if (!hasDatabaseEnv()) return null;
  return {
    sessions: { async getUser(token: string) { const { user, error } = await verifyAccessToken(token); return { data: { user }, error }; } },
    users: { delete: deleteLocalUser },
  };
}
export type ServerContext = NonNullable<ReturnType<typeof createServerContext>>;
