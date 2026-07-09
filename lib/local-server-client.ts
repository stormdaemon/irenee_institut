import { query } from "@/lib/db";
import { deleteLocalUser, verifyAccessToken, type LocalUser } from "@/lib/local-auth";

type QueryResponse<T = any[]> = {
  count?: number | null;
  data: T | null;
  error: { message: string } | null;
};

type Filter = {
  column: string;
  op: "=" | ">" | "<" | ">=" | "<=" | "in";
  value: unknown;
};

type Order = {
  column: string;
  ascending: boolean;
};

type SelectOptions = {
  count?: "exact";
  head?: boolean;
};

type RelationSelect = {
  columns: string[];
  name: string;
  star: boolean;
};

const defaultConflicts: Record<string, string[]> = {
  book_requests: ["paypal_order_id"],
  course_enrollments: ["course_id", "etudiant_id"],
  module_progress: ["etudiant_id", "module_id"],
  payment_events: ["provider", "provider_event_id"],
  paypal_orders: ["order_id"],
  profiles: ["id"],
  system_settings: ["key"]
};

function dbError(error: unknown) {
  return { message: error instanceof Error ? error.message : String(error) };
}

function assertIdentifier(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }
  return value;
}

function qid(value: string) {
  return `"${assertIdentifier(value)}"`;
}

function splitTopLevel(input: string) {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSelect(input = "*") {
  const columns: string[] = [];
  const relations: RelationSelect[] = [];
  for (const token of splitTopLevel(input || "*")) {
    const relation = token.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
    if (relation) {
      const nested = relation[2].trim() || "*";
      relations.push({
        columns: nested === "*" ? [] : splitTopLevel(nested),
        name: relation[1],
        star: nested === "*"
      });
    } else {
      columns.push(token);
    }
  }
  return {
    columns: columns.length ? columns : ["*"],
    relations,
    star: columns.includes("*")
  };
}

function relationFor(sourceTable: string, relationName: string) {
  if (sourceTable === "courses" && relationName === "course_modules") {
    return { many: true, sourceKey: "id", targetKey: "course_id", targetTable: "course_modules" };
  }
  if (sourceTable === "homework" && relationName === "homework_assignments") {
    return { many: true, sourceKey: "id", targetKey: "homework_id", targetTable: "homework_assignments" };
  }
  if (sourceTable === "course_modules" && relationName === "courses") {
    return { many: false, sourceKey: "course_id", targetKey: "id", targetTable: "courses" };
  }
  if (sourceTable === "book_requests" && relationName === "courses") {
    return { many: false, sourceKey: "course_id", targetKey: "id", targetTable: "courses" };
  }
  if (relationName === "profiles") {
    const sourceKey = sourceTable === "marketing_campaign_deliveries" ? "profile_id" : "user_id";
    return { many: false, sourceKey, targetKey: "id", targetTable: "profiles" };
  }
  throw new Error(`Unsupported relation ${sourceTable}.${relationName}`);
}

function projectRow(row: Record<string, unknown>, selection: ReturnType<typeof parseSelect>) {
  const projected: Record<string, unknown> = {};
  if (selection.star) {
    Object.assign(projected, row);
  } else {
    for (const column of selection.columns) {
      if (column === "*") continue;
      projected[column] = row[column];
    }
  }
  for (const relation of selection.relations) {
    projected[relation.name] = row[relation.name];
  }
  return projected;
}

function projectRelated(row: Record<string, unknown>, relation: RelationSelect) {
  if (relation.star) return row;
  return Object.fromEntries(relation.columns.map(column => [column, row[column]]));
}

async function attachRelations(table: string, rows: Record<string, unknown>[], selection: ReturnType<typeof parseSelect>) {
  for (const relation of selection.relations) {
    const config = relationFor(table, relation.name);
    const keys = [...new Set(rows.map(row => row[config.sourceKey]).filter(Boolean))];
    if (!keys.length) {
      rows.forEach(row => {
        row[relation.name] = config.many ? [] : null;
      });
      continue;
    }

    const targetColumns = relation.star ? ["*"] : [...new Set([...relation.columns, config.targetKey])];
    const projection = targetColumns.includes("*")
      ? "*"
      : targetColumns.map(column => qid(column)).join(", ");
    const result = await query<Record<string, unknown>>(
      `select ${projection} from public.${qid(config.targetTable)} where ${qid(config.targetKey)} = any($1::uuid[])`,
      [keys]
    );

    if (config.many) {
      const grouped = new Map<unknown, Record<string, unknown>[]>();
      for (const related of result.rows) {
        const list = grouped.get(related[config.targetKey]) || [];
        list.push(projectRelated(related, relation));
        grouped.set(related[config.targetKey], list);
      }
      rows.forEach(row => {
        row[relation.name] = grouped.get(row[config.sourceKey]) || [];
      });
    } else {
      const mapped = new Map(result.rows.map(row => [row[config.targetKey], projectRelated(row, relation)]));
      rows.forEach(row => {
        row[relation.name] = mapped.get(row[config.sourceKey]) || null;
      });
    }
  }
}

function buildWhere(filters: Filter[], values: unknown[]) {
  if (!filters.length) return "";
  const clauses = filters.map(filter => {
    const column = qid(filter.column);
    if (filter.op === "in") {
      const list = Array.isArray(filter.value) ? filter.value : [];
      if (!list.length) return "false";
      const placeholders = list.map(value => {
        values.push(value);
        return `$${values.length}`;
      });
      return `${column} in (${placeholders.join(", ")})`;
    }
    values.push(filter.value);
    return `${column} ${filter.op} $${values.length}`;
  });
  return ` where ${clauses.join(" and ")}`;
}

function buildOrder(orders: Order[]) {
  if (!orders.length) return "";
  return ` order by ${orders.map(order => `${qid(order.column)} ${order.ascending ? "asc" : "desc"}`).join(", ")}`;
}

function normalizeRowsPayload(payload: Record<string, unknown> | Record<string, unknown>[]) {
  return Array.isArray(payload) ? payload : [payload];
}

function columnsForRows(rows: Record<string, unknown>[]) {
  return [...new Set(rows.flatMap(row => Object.keys(row)))];
}

class LocalQueryBuilder implements PromiseLike<QueryResponse<any[]>> {
  private filters: Filter[] = [];
  private limitCount: number | null = null;
  private mutation: "delete" | "insert" | "update" | "upsert" | null = null;
  private mutationPayload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private orders: Order[] = [];
  private returningSelection: string | null = null;
  private selectOptions: SelectOptions = {};
  private selectQuery = "*";
  private upsertConflict: string[] | null = null;

  constructor(private table: string) {}

  delete() {
    this.mutation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: "=", value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, op: ">", value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, op: "in", value });
    return this;
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this.mutation = "insert";
    this.mutationPayload = payload;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    return this.execute("maybeSingle");
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  select(columns = "*", options: SelectOptions = {}) {
    if (this.mutation) {
      this.returningSelection = columns || "*";
    } else {
      this.selectQuery = columns || "*";
      this.selectOptions = options || {};
    }
    return this;
  }

  single() {
    return this.execute("single");
  }

  then<TResult1 = QueryResponse<any[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<any[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  update(payload: Record<string, unknown>) {
    this.mutation = "update";
    this.mutationPayload = payload;
    return this;
  }

  upsert(payload: Record<string, unknown> | Record<string, unknown>[], options: { onConflict?: string } = {}) {
    this.mutation = "upsert";
    this.mutationPayload = payload;
    this.upsertConflict = options.onConflict?.split(",").map(item => item.trim()).filter(Boolean) || null;
    return this;
  }

  private async execute(singleMode?: "maybeSingle" | "single"): Promise<QueryResponse<any[] | any>> {
    try {
      if (this.mutation) return await this.executeMutation(singleMode);
      return await this.executeSelect(singleMode);
    } catch (error) {
      return { data: null, error: dbError(error) };
    }
  }

  private async executeSelect(singleMode?: "maybeSingle" | "single"): Promise<QueryResponse<any>> {
    const values: unknown[] = [];
    const where = buildWhere(this.filters, values);
    const selection = parseSelect(this.selectQuery);

    if (this.selectOptions.head && this.selectOptions.count === "exact") {
      const result = await query<{ count: string }>(`select count(*)::text as count from public.${qid(this.table)}${where}`, values);
      return { count: Number(result.rows[0]?.count || 0), data: null, error: null };
    }

    const projection = selection.relations.length || selection.star
      ? "t.*"
      : selection.columns.map(column => `t.${qid(column)}`).join(", ");
    const order = buildOrder(this.orders);
    const limit = this.limitCount === null ? "" : ` limit ${Math.max(0, this.limitCount)}`;
    const result = await query<Record<string, unknown>>(
      `select ${projection} from public.${qid(this.table)} t${where}${order}${limit}`,
      values
    );
    const rows = result.rows;
    await attachRelations(this.table, rows, selection);
    return this.shapeRows(rows.map(row => projectRow(row, selection)), singleMode);
  }

  private async executeMutation(singleMode?: "maybeSingle" | "single"): Promise<QueryResponse<any>> {
    if (this.mutation === "delete") {
      const values: unknown[] = [];
      const where = buildWhere(this.filters, values);
      await query(`delete from public.${qid(this.table)}${where}`, values);
      return { data: null, error: null };
    }

    if (this.mutation === "update") {
      const payload = this.mutationPayload as Record<string, unknown>;
      const values = Object.values(payload);
      const assignments = Object.keys(payload).map((column, index) => `${qid(column)} = $${index + 1}`);
      const where = buildWhere(this.filters, values);
      const returning = this.returningSelection ? " returning *" : "";
      const result = await query<Record<string, unknown>>(
        `update public.${qid(this.table)} set ${assignments.join(", ")}${where}${returning}`,
        values
      );
      return this.shapeMutationRows(result.rows, singleMode);
    }

    const rows = normalizeRowsPayload(this.mutationPayload || {});
    if (!rows.length) return { data: null, error: null };
    const columns = columnsForRows(rows);
    const values: unknown[] = [];
    const tuples = rows.map(row => {
      const placeholders = columns.map(column => {
        values.push(row[column] === undefined ? null : row[column]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const columnSql = columns.map(qid).join(", ");
    const returning = this.returningSelection ? " returning *" : "";

    if (this.mutation === "insert") {
      const result = await query<Record<string, unknown>>(
        `insert into public.${qid(this.table)} (${columnSql}) values ${tuples.join(", ")}${returning}`,
        values
      );
      return this.shapeMutationRows(result.rows, singleMode);
    }

    const conflict = this.upsertConflict || defaultConflicts[this.table] || (columns.includes("id") ? ["id"] : []);
    if (!conflict.length) throw new Error(`No upsert conflict target configured for ${this.table}.`);
    const updateColumns = columns.filter(column => !conflict.includes(column));
    const updateSql = updateColumns.length
      ? `do update set ${updateColumns.map(column => `${qid(column)} = excluded.${qid(column)}`).join(", ")}`
      : "do nothing";
    const result = await query<Record<string, unknown>>(
      `insert into public.${qid(this.table)} (${columnSql}) values ${tuples.join(", ")}
       on conflict (${conflict.map(qid).join(", ")}) ${updateSql}${returning}`,
      values
    );
    return this.shapeMutationRows(result.rows, singleMode);
  }

  private async shapeMutationRows(rows: Record<string, unknown>[], singleMode?: "maybeSingle" | "single") {
    if (!this.returningSelection) return { data: null, error: null };
    const selection = parseSelect(this.returningSelection);
    await attachRelations(this.table, rows, selection);
    return this.shapeRows(rows.map(row => projectRow(row, selection)), singleMode);
  }

  private shapeRows(rows: Record<string, unknown>[], singleMode?: "maybeSingle" | "single"): QueryResponse<any> {
    if (singleMode === "single") {
      if (rows.length !== 1) return { data: null, error: { message: rows.length ? "Multiple rows returned." : "Row not found." } };
      return { data: rows[0], error: null };
    }
    if (singleMode === "maybeSingle") {
      if (rows.length > 1) return { data: null, error: { message: "Multiple rows returned." } };
      return { data: rows[0] || null, error: null };
    }
    return { data: rows, error: null };
  }
}

export function createLocalServerClient() {
  return {
    auth: {
      admin: {
        deleteUser: deleteLocalUser
      },
      async getUser(token: string) {
        const { user, error } = await verifyAccessToken(token);
        return { data: { user }, error };
      }
    },
    from(table: string) {
      return new LocalQueryBuilder(table);
    },
    async rpc(name: string, params: Record<string, unknown>) {
      try {
        if (name === "validate_payment") {
          const result = await query<{ result: unknown }>(
            `select public.validate_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) as result`,
            [
              params.p_provider,
              params.p_order_id,
              params.p_capture_id,
              params.p_user_id,
              params.p_course_id,
              params.p_amount_total,
              params.p_currency,
              params.p_event_name,
              JSON.stringify(params.p_raw_payload || {}),
              params.p_book_requested,
              params.p_book_title,
              params.p_product_type
            ]
          );
          return { data: result.rows[0]?.result || null, error: null };
        }
        if (name === "process_payment_reversal") {
          const result = await query<{ result: unknown }>(
            `select public.process_payment_reversal($1,$2,$3,$4,$5,$6,$7,$8,$9) as result`,
            [
              params.p_provider,
              params.p_provider_event_id,
              params.p_event_name,
              params.p_kind,
              params.p_object_id,
              params.p_order_id,
              params.p_capture_id,
              params.p_amount_total,
              params.p_currency
            ]
          );
          return { data: result.rows[0]?.result || null, error: null };
        }
        if (name !== "validate_paypal_payment") throw new Error(`Unsupported RPC: ${name}`);
        const result = await query<{ result: unknown }>(
          `select public.validate_paypal_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result`,
          [
            params.p_order_id,
            params.p_capture_id,
            params.p_user_id,
            params.p_course_id,
            params.p_amount_total,
            params.p_currency,
            params.p_event_name,
            JSON.stringify(params.p_raw_payload || {}),
            params.p_book_requested,
            params.p_book_title,
            params.p_product_type
          ]
        );
        return { data: result.rows[0]?.result || null, error: null };
      } catch (error) {
        return { data: null, error: dbError(error) };
      }
    }
  };
}

export type LocalServerClient = ReturnType<typeof createLocalServerClient>;
export type LocalServerUser = LocalUser;
