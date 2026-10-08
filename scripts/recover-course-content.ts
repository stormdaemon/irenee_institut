import { mkdir, readFile, writeFile } from "node:fs/promises";

// Read-only recovery of this institute's teaching content. Never export users,
// payment records, credentials, or the complete legacy database.
const source = process.argv[2];
if (!source) throw new Error("An explicit legacy environment file is required.");
const env = Object.fromEntries((await readFile(source, "utf8")).split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line))
  .map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const origin = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if (origin.protocol !== "https:" || origin.hostname !== "dessfamxswtuyzzkcuet.supabase.co") {
  throw new Error("Unexpected legacy institute endpoint; no credentials sent.");
}
const key = env.SUPABASE_SECRET_KEY;
if (!key) throw new Error("Legacy credential absent.");
await mkdir(".recovery/content", { recursive: true });
for (const table of ["courses", "course_modules"] as const) {
  const response = await fetch(new URL(`/rest/v1/${table}?select=*&limit=5000`, origin), {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
    signal: AbortSignal.timeout(15000),
    redirect: "error"
  }).catch(() => null);
  if (!response) { console.log(`${table}: endpoint unreachable`); continue; }
  if (!response.ok) { console.log(`${table}: HTTP ${response.status}; no data recovered`); continue; }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Unexpected content response.");
  await writeFile(`.recovery/content/legacy-${table}.json`, JSON.stringify({
    retrievedAt: new Date().toISOString(), source: origin.hostname, contentRange: response.headers.get("content-range"), rows
  }, null, 2));
  console.log(`${table}: ${rows.length} records recovered; content-range=${response.headers.get("content-range")}`);
}
