import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("student learning routes wire published-course and server-owned progress controls", () => {
  const progress = source("app/api/progress/update/route.ts");
  assert.match(progress, /parseModuleCompletion\(/);
  assert.match(progress, /hasPublishedCourseAccess\(/);
  assert.match(progress, /\.eq\("statut",\s*"publie"\)/);
  assert.doesNotMatch(progress, /from\("course_enrollments"\)\s*\.upsert/);

  const me = source("app/api/me/route.ts");
  assert.match(me, /\.eq\("statut",\s*"en_cours"\)/);
  assert.match(me, /\.eq\("statut",\s*"publie"\)/);

  const exam = source("app/api/final-exam/route.ts");
  assert.match(exam, /normalizeFinalExamAnswers\(/);
  assert.match(exam, /evaluateExamAttemptWindow\(/);
  assert.match(exam, /checkRateLimit\(`final-exam:cooldown:user:\$\{context\.userId\}`/);
  assert.match(exam, /checkRateLimit\(`final-exam:daily:user:\$\{context\.userId\}`/);
});
