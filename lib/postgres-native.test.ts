import { afterEach, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { query } from "./db";
import { pgRead, pgInsert, pgUpdate } from "./postgres";

const created: string[] = [];
afterEach(async () => {
  if (created.length) await query("delete from public.courses where id=any($1::uuid[])", [created.splice(0)]);
});

test("native PostgreSQL parameter binding keeps SQL input as data", async () => {
  const payload = "'; drop table public.courses; --";
  const result = await pgRead("select $1::text as value", [payload], "one");
  expect(result.error).toBeNull();
  expect(result.data!.value).toBe(payload);
});

test("native PostgreSQL cardinality distinguishes an empty result from a missing required row", async () => {
  expect((await pgRead("select 1 where false", [], "optional")).data).toBeNull();
  expect((await pgRead("select 1 where false", [], "one")).error).not.toBeNull();
  expect((await pgRead("select generate_series(1,2)", [], "optional")).error).not.toBeNull();
  expect((await pgRead("select 1 where false")).data).toEqual([]);
});

test("native PostgreSQL returns database failures without pretending success", async () => {
  const result = await pgRead("select 1 / 0");
  expect(result.data).toBeNull();
  expect(result.error).not.toBeNull();
});

test("native course insert and update round-trip arrays and enforce column allowlists", async () => {
  const id = randomUUID(); created.push(id);
  const input = { id, titre: "Cours natif", slug: `native-${id}`, objectifs: ["Lire", "Comprendre"], statut: "brouillon" };
  const inserted = await pgInsert("courses", input, { returning: "one" });
  expect(inserted.error).toBeNull();
  expect(inserted.data.objectifs).toEqual(input.objectifs);
  const updated = await pgUpdate("courses", { titre: "Cours révisé" }, 't."id" = $1', [id], { returning: "one" });
  expect(updated.error).toBeNull();
  expect(updated.data.titre).toBe("Cours révisé");
  expect((await pgInsert("courses;drop table profiles", input)).error).not.toBeNull();
  expect((await pgUpdate("courses", { "titre = null;--": "bad" }, 't."id" = $1', [id])).error).not.toBeNull();
  expect((await pgRead('select titre from public.courses where id=$1', [id], "one")).data!.titre).toBe("Cours révisé");
});
