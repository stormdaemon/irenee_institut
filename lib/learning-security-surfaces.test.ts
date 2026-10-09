import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "bun:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("student learning routes wire published-course and server-owned progress controls", () => {
  const progress = source("app/api/progress/update/route.ts");
  assert.match(progress, /parseModuleCompletion\(/);
  assert.match(progress, /hasPublishedCourseAccess\(/);
  assert.ok(progress.includes('[courseId, "publie"]'));
  assert.doesNotMatch(progress, /from\("course_enrollments"\)\s*\.upsert/);
  assert.match(progress, /currentProgress\.complete !== true && !currentProgress\.date_debut/);
  assert.match(progress, /pgUpdate\("module_progress", \{ date_debut: now, statut: "en_cours", updated_at: now \}/);

  const me = source("app/api/me/route.ts");
  assert.ok(me.includes('[user.id, "en_cours"]'));
  assert.ok(me.includes('"publie"'));

  const exam = source("app/api/final-exam/route.ts");
  assert.match(exam, /normalizeFinalExamAnswers\(/);
  assert.match(exam, /evaluateExamAttemptWindow\(/);
  assert.match(exam, /checkRateLimit\(`final-exam:cooldown:user:\$\{context\.userId\}`/);
  assert.match(exam, /checkRateLimit\(`final-exam:daily:user:\$\{context\.userId\}`/);
});

test("student course overview cannot serialize module content and module delivery is sequential", () => {
  const overview = source("app/api/learning/courses/[slug]/route.ts");
  const moduleRoute = source("app/api/learning/courses/[slug]/modules/[moduleId]/route.ts");
  const studentDashboard = source("app/api/me/route.ts");

  assert.doesNotMatch(overview, /\.select\("\*"\)/);
  assert.ok(overview.includes('t.\\"type_contenu\\" from public.\\"course_modules\\"'));
  assert.doesNotMatch(overview, /projectPublicQuiz/);

  assert.doesNotMatch(moduleRoute, /\.select\("\*"\)/);
  assert.ok(moduleRoute.includes('t.\\"quiz\\" from public.\\"course_modules\\"'));
  assert.match(moduleRoute, /projectPublicQuiz/);
  assert.match(moduleRoute, /completedModuleIds/);
  assert.match(moduleRoute, /resumeModuleId/);
  assert.match(moduleRoute, /\},\s*409\);/);
  assert.match(moduleRoute, /"Cache-Control":\s*"private, no-store"/);

  assert.doesNotMatch(studentDashboard, /from\("course_modules"\)[\s\S]{0,120}\.select\("\*"\)/);
  assert.ok(studentDashboard.includes('t.\\"type_contenu\\" from public.\\"course_modules\\"'));
  assert.doesNotMatch(studentDashboard, /projectPublicQuiz/);
  assert.doesNotMatch(studentDashboard, /contenu_html:\s*module/);
});
