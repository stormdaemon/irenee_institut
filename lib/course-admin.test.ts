import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { createCourse, updateCourse } from "./course-admin";
import { parseCourseForm } from "./course-input";
import { query } from "./db";

const createdUserIds: string[] = [];
const createdCourseIds: string[] = [];

function formFor(slug: string, title = "Cours transactionnel") {
  const form = new FormData();
  form.set("titre", title);
  form.set("slug", slug);
  form.set("description", "Description de test suffisamment précise.");
  form.set("niveau", "debutant");
  form.set("statut", "brouillon");
  form.set("semestre", "1");
  form.set("numero", "10");
  form.set("prix", "99");
  form.set("prix_reduit", "79");
  form.set("duree_totale_minutes", "60");
  form.set("objectifs", "[]");
  form.set("competences", "[]");
  form.set("prerequis", "[]");
  form.set("modules", JSON.stringify([
    {
      titre: "Module vidéo",
      description: "Un module complet.",
      contenu_html: "<p>Contenu <strong>sûr</strong><script>alert(1)</script></p>",
      duree: 45,
      type_contenu: "video",
      url_video: "https://cdn.example.test/course.mp4"
    }
  ]));
  return form;
}

beforeEach(async () => {
  const database = await query<{ name: string }>("select current_database() as name");
  assert.match(database.rows[0]?.name || "", /security_test/, "course-admin tests must use the isolated security database");
});

afterEach(async () => {
  while (createdCourseIds.length) {
    await query("delete from public.courses where id = $1", [createdCourseIds.pop()]);
  }
  while (createdUserIds.length) {
    await query("delete from auth.users where id = $1", [createdUserIds.pop()]);
  }
});

async function author() {
  const id = randomUUID();
  const email = `course-author-${id}@example.test`;
  await query(
    `insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at,is_sso_user,is_anonymous)
     values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,now(),now(),false,false)`,
    [id, email]
  );
  await query(
    "insert into public.profiles (id,email,nom,prenom,role) values ($1,$2,'Test','Auteur','formateur')",
    [id, email]
  );
  createdUserIds.push(id);
  return { id, email, nom: "Test", prenom: "Auteur", role: "formateur" as const };
}

test("createCourse persists a sanitized course and its video module atomically", async () => {
  const actor = await author();
  const parsed = parseCourseForm(formFor(`security-${randomUUID()}`));
  const course = await createCourse(parsed, actor);
  createdCourseIds.push(course.id);

  assert.equal(course.course_modules.length, 1);
  assert.equal(course.course_modules[0].url_video, "https://cdn.example.test/course.mp4");
  assert.doesNotMatch(String(course.course_modules[0].contenu_html), /script|alert\(1\)/i);
});

test("updateCourse rolls back every change when a submitted module belongs to another course", async () => {
  const actor = await author();
  const first = await createCourse(parseCourseForm(formFor(`first-${randomUUID()}`, "Titre initial")), actor);
  const second = await createCourse(parseCourseForm(formFor(`second-${randomUUID()}`, "Autre cours")), actor);
  createdCourseIds.push(first.id, second.id);

  const form = formFor(String(first.slug), "Titre compromis");
  form.set("modules", JSON.stringify([
    {
      id: second.course_modules[0].id,
      titre: "Module déplacé",
      contenu_html: "<p>attaque</p>",
      duree: 20,
      type_contenu: "texte"
    }
  ]));

  await assert.rejects(() => updateCourse(first.id, parseCourseForm(form), actor), /module.*cours/i);

  const persisted = await query<{ titre: string }>("select titre from public.courses where id = $1", [first.id]);
  assert.equal(persisted.rows[0]?.titre, "Titre initial");
  const moduleOwner = await query<{ course_id: string }>("select course_id from public.course_modules where id = $1", [second.course_modules[0].id]);
  assert.equal(moduleOwner.rows[0]?.course_id, second.id);
});
