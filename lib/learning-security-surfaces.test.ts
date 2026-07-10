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
  assert.match(progress, /currentProgress\.complete !== true && !currentProgress\.date_debut/);
  assert.match(progress, /\.update\(\{ date_debut: now, statut: "en_cours", updated_at: now \}\)/);

  const me = source("app/api/me/route.ts");
  assert.match(me, /\.eq\("statut",\s*"en_cours"\)/);
  assert.match(me, /\.eq\("statut",\s*"publie"\)/);

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
  assert.match(overview, /\.select\("id,course_id,titre,description,ordre,duree,type_contenu"\)/);
  assert.doesNotMatch(overview, /projectPublicQuiz/);

  assert.doesNotMatch(moduleRoute, /\.select\("\*"\)/);
  assert.match(moduleRoute, /\.select\("id,course_id,titre,description,ordre,contenu,contenu_html,url_video,url_sous_titres,duree,ressources,type_contenu,quiz"\)/);
  assert.match(moduleRoute, /projectPublicQuiz/);
  assert.match(moduleRoute, /completedModuleIds/);
  assert.match(moduleRoute, /resumeModuleId/);
  assert.match(moduleRoute, /\},\s*409\);/);
  assert.match(moduleRoute, /"Cache-Control":\s*"private, no-store"/);

  assert.doesNotMatch(studentDashboard, /from\("course_modules"\)[\s\S]{0,120}\.select\("\*"\)/);
  assert.match(studentDashboard, /\.select\("id,course_id,titre,description,ordre,duree,type_contenu"\)/);
  assert.doesNotMatch(studentDashboard, /projectPublicQuiz/);
  assert.doesNotMatch(studentDashboard, /contenu_html:\s*module/);
});
