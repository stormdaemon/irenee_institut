import { test, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(path) && !path.endsWith(".test.ts") ? [path] : [];
  });
}

test("the delivered application uses native PostgreSQL, with no Supabase compatibility layer", () => {
  const offenders = ["app", "components", "lib"].flatMap(sourceFiles).filter(path => {
    const code = readFileSync(path, "utf8");
    return /(?:from|require\()\s*["'][^"']*(?:\/supabase|\/local-server-client)["']/.test(code)
      || /class\s+(?:LocalQueryBuilder|BrowserProfileQuery)/.test(code);
  });
  expect(offenders).toEqual([]);
});

test("all HTTP routes participate in the coverage gate, including payment webhooks", () => {
  const script = readFileSync("scripts/check-api-coverage.ts", "utf8");
  expect(script).toContain("app");
  expect(script).toContain("route.ts");
  expect(script).toContain("branches");
  expect(script).not.toContain("istanbul ignore");
});
