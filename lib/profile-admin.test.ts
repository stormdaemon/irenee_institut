import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { createCourse } from "./course-admin";
import { parseCourseForm } from "./course-input";
import { query } from "./db";
import { replaceManualCourseEnrollments } from "./profile-admin";

const users: string[] = [];
const courses: string[] = [];

beforeEach(async () => {
  const database = await query<{ name: string }>("select current_database() as name");
  assert.match(database.rows[0]?.name || "", /security_test/);
});

afterEach(async () => {
  while (courses.length) await query("delete from public.courses where id=$1", [courses.pop()]);
  while (users.length) await query("delete from auth.users where id=$1", [users.pop()]);
});

async function profile(role: "directeur" | "etudiant") {
  const id = randomUUID();
  const email = `${role}-${id}@example.test`;
  await query(
    `insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at,is_sso_user,is_anonymous)
     values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,now(),now(),false,false)`,
    [id, email]
  );
  await query("insert into public.profiles (id,email,nom,prenom,role) values ($1,$2,'Test',$3,$4)", [id, email, role, role]);
  users.push(id);
  return { email, id, nom: "Test", prenom: role, role };
}

function courseForm(slug: string) {
  const form = new FormData();
  form.set("titre", slug);
  form.set("slug", slug);
  form.set("description", "Cours d'intégration sécurisé.");
  form.set("niveau", "debutant");
  form.set("statut", "publie");
  form.set("semestre", "1");
  form.set("numero", "1");
  form.set("prix", "0");
  form.set("prix_reduit", "0");
  form.set("duree_totale_minutes", "0");
  form.set("objectifs", "[]");
  form.set("competences", "[]");
  form.set("prerequis", "[]");
  form.set("modules", "[]");
  return form;
}

test("manual enrollment replacement is atomic and never converts pass access to permanent access", async () => {
  const director = await profile("directeur");
  const student = await profile("etudiant");
  for (const slug of ["pass", "legacy-old", "legacy-new"]) {
    const course = await createCourse(parseCourseForm(courseForm(`${slug}-${randomUUID()}`)), {
      ...director,
      role: "directeur"
    });
    courses.push(course.id);
  }
  await query(
    `insert into public.course_enrollments (etudiant_id,course_id,statut,access_source,access_expires_at)
     values ($1,$2,'en_cours','annual_pass',now()+interval '30 days'),($1,$3,'en_cours','legacy',null)`,
    [student.id, courses[0], courses[1]]
  );

  const rows = await replaceManualCourseEnrollments(student.id, [courses[0], courses[2]]);
  const byCourse = new Map(rows.map(row => [String(row.course_id), String(row.access_source)]));
  assert.equal(byCourse.get(courses[0]), "annual_pass");
  assert.equal(byCourse.has(courses[1]), false);
  assert.equal(byCourse.get(courses[2]), "legacy");
});
