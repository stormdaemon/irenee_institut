import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("course mutations share a persistent per-user rate limit before parsing large forms", async () => {
  for (const path of ["app/api/courses/route.ts", "app/api/courses/[id]/route.ts"]) {
    const route = await source(path);
    const authorization = route.indexOf("await authorizeRequest");
    const limiter = route.indexOf("await checkRateLimit");
    const parser = route.indexOf("parseCourseForm(await readFormDataBodyWithLimit");

    assert.ok(authorization >= 0 && limiter > authorization && parser > limiter, `${path} must rate-limit an authorized user before parsing`);
    assert.match(route, /`course-write:user:\$\{auth\.user\.id\}`/);
    assert.match(route, /status: 429/);
    assert.match(route, /"Retry-After"/);
  }
});
