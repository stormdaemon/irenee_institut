import { createCoverageMap } from "istanbul-lib-coverage";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(path) : entry.name === "route.ts" ? [resolve(path)] : [];
  });
}

const routes = routeFiles("app");
const map = createCoverageMap(JSON.parse(readFileSync("coverage/api-coverage.json", "utf8")));
const failures: string[] = [];
for (const path of routes) {
  if (!map.files().includes(path)) {
    failures.push(`${relative(process.cwd(), path)}: not instrumented or never loaded`);
    continue;
  }
  const summary = map.fileCoverageFor(path).toSummary();
  for (const metric of ["statements", "branches", "functions", "lines"] as const) {
    if (summary[metric].covered !== summary[metric].total) {
      failures.push(`${relative(process.cwd(), path)}: ${metric} ${summary[metric].covered}/${summary[metric].total} (${summary[metric].pct}%)`);
    }
  }
}
const report = Object.fromEntries(routes.map(path => [relative(process.cwd(), path).replaceAll("\\", "/"), map.files().includes(path) ? map.fileCoverageFor(path).toSummary().toJSON() : { missing: true }]));
writeFileSync("coverage/api-summary.json", JSON.stringify({generatedAt:new Date().toISOString(),routeCount:routes.length,routes:report},null,2));
if (!routes.length) failures.push("No HTTP routes found; refusing an empty coverage pass.");
if (failures.length) {
  console.error(`API coverage gate failed (${routes.length} route files):\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`All ${routes.length} HTTP route files: 100% statements, branches, functions and lines.`);
}
