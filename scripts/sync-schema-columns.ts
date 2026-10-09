import { writeFileSync } from "node:fs";
import { getPool, query } from "../lib/db";

try {
  const result = await query<{table_name:string;column_name:string;data_type:string}>(
    "select table_name,column_name,data_type from information_schema.columns where table_schema='public' order by table_name,ordinal_position");
  const schema:Record<string,Record<string,string>> = {};
  for(const row of result.rows) (schema[row.table_name] ||= {})[row.column_name] = row.data_type;
  if(!schema.courses || !schema.course_modules) throw new Error("Not an Institute database.");
  writeFileSync("database/schema-columns.json",JSON.stringify(schema,null,2)+"\n");
  console.log(`Synchronized ${Object.keys(schema).length} native PostgreSQL tables.`);
} finally { await getPool().end(); }
