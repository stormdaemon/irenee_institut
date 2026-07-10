import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, test } from "node:test";
import { createCourse, updateCourse } from "./course-admin";
import { parseCourseForm } from "./course-input";
import { query } from "./db";
import { getCourses } from "./server-data";

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
      url_video: "https://res.cloudinary.com/da52mpv3g/video/upload/course.mp4",
      url_sous_titres: "https://res.cloudinary.com/da52mpv3g/raw/upload/course-fr.vtt"
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
  assert.equal(course.course_modules[0].url_video, "https://res.cloudinary.com/da52mpv3g/video/upload/course.mp4");
  assert.equal(course.course_modules[0].url_sous_titres, "https://res.cloudinary.com/da52mpv3g/raw/upload/course-fr.vtt");
  assert.doesNotMatch(String(course.course_modules[0].contenu_html), /script|alert\(1\)/i);
});

test("updateCourse rolls back every change when a submitted module belongs to another course", async () => {
  const actor = await author();
  const first = await createCourse(parseCourseForm(formFor(`first-${randomUUID()}`, "Titre initial")), actor);
  const second = await createCourse(parseCourseForm(formFor(`second-${randomUUID()}`, "Autre cours")), actor);
  createdCourseIds.push(first.id, second.id);

  const form = formFor(String(first.slug), "Titre compromis");
  form.set("expected_updated_at", String(first.updated_at));
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

test("updateCourse rejects a stale editor version instead of overwriting newer work", async () => {
  const actor = await author();
  const created = await createCourse(parseCourseForm(formFor(`version-${randomUUID()}`, "Version initiale")), actor);
  createdCourseIds.push(created.id);

  const listed = (await getCourses("admin", { authorId: actor.id })).find(course => course.id === created.id);
  assert.ok(listed, "the freshly created course must be returned by the admin list");
  assert.equal(listed.updated_at, created.updated_at, "the admin list must preserve the exact PostgreSQL concurrency token");

  const firstUpdate = formFor(String(created.slug), "Version onglet A");
  firstUpdate.set("expected_updated_at", String(listed.updated_at));
  await updateCourse(created.id, parseCourseForm(firstUpdate), actor);

  const staleUpdate = formFor(String(created.slug), "Version onglet B périmée");
  staleUpdate.set("expected_updated_at", String(created.updated_at));
  await assert.rejects(() => updateCourse(created.id, parseCourseForm(staleUpdate), actor), /modifié.*autre|recharger/i);

  const persisted = await query<{ titre: string }>("select titre from public.courses where id = $1", [created.id]);
  assert.equal(persisted.rows[0]?.titre, "Version onglet A");
});

test("createCourse persists quiz answers for server-only grading", async () => {
  const actor = await author();
  const form = formFor(`quiz-${randomUUID()}`, "Quiz transactionnel");
  form.set("modules", JSON.stringify([{
    titre: "Quiz",
    type_contenu: "quiz",
    quiz: [{ id: "q-1", question: "Bonne réponse ?", options: ["A", "B"], answer: 1 }],
  }]));
  const course = await createCourse(parseCourseForm(form), actor);
  createdCourseIds.push(course.id);

  assert.deepEqual(course.course_modules[0].quiz, [{ id: "q-1", question: "Bonne réponse ?", options: ["A", "B"], answer: 1 }]);
});

test("updating legacy module fields does not erase an omitted quiz", async () => {
  const actor = await author();
  const createForm = formFor(`quiz-preserved-${randomUUID()}`, "Quiz à préserver");
  createForm.set("modules", JSON.stringify([{
    titre: "Quiz",
    type_contenu: "quiz",
    quiz: [{ id: "q-keep", question: "Réponse ?", options: ["A", "B"], answer: 0 }],
  }]));
  const created = await createCourse(parseCourseForm(createForm), actor);
  createdCourseIds.push(created.id);

  const updateForm = formFor(String(created.slug), "Quiz renommé");
  updateForm.set("expected_updated_at", String(created.updated_at));
  updateForm.set("modules", JSON.stringify([{
    id: created.course_modules[0].id,
    titre: "Quiz renommé",
    type_contenu: "quiz",
  }]));
  const updated = await updateCourse(created.id, parseCourseForm(updateForm), actor);

  assert.deepEqual(updated.course_modules[0].quiz, [{ id: "q-keep", question: "Réponse ?", options: ["A", "B"], answer: 0 }]);
});

test("legacy editors preserve captions while an explicit empty value clears them", async () => {
  const actor = await author();
  const created = await createCourse(parseCourseForm(formFor(`captions-preserved-${randomUUID()}`)), actor);
  createdCourseIds.push(created.id);

  const legacyUpdate = formFor(String(created.slug), "Sous-titres préservés");
  legacyUpdate.set("expected_updated_at", String(created.updated_at));
  legacyUpdate.set("modules", JSON.stringify([{
    id: created.course_modules[0].id,
    titre: "Module vidéo historique",
    contenu_html: "<p>Transcription</p>",
    duree: 45,
    type_contenu: "video",
    url_video: "https://res.cloudinary.com/da52mpv3g/video/upload/course.mp4",
  }]));
  const preserved = await updateCourse(created.id, parseCourseForm(legacyUpdate), actor);
  assert.equal(preserved.course_modules[0].url_sous_titres, "https://res.cloudinary.com/da52mpv3g/raw/upload/course-fr.vtt");

  const explicitClear = formFor(String(created.slug), "Sous-titres effacés");
  explicitClear.set("expected_updated_at", String(preserved.updated_at));
  explicitClear.set("modules", JSON.stringify([{
    id: created.course_modules[0].id,
    titre: "Module vidéo sans média",
    contenu_html: "<p>Le texte remplace la vidéo retirée.</p>",
    duree: 45,
    type_contenu: "texte",
    url_video: "",
    url_sous_titres: "",
  }]));
  const cleared = await updateCourse(created.id, parseCourseForm(explicitClear), actor);
  assert.equal(cleared.course_modules[0].url_sous_titres, null);
});

test("the admin course list fails closed when its module query fails", async () => {
  const source = await readFile(new URL("./server-data.ts", import.meta.url), "utf8");
  assert.match(source, /data:\s*moduleRows,\s*error:\s*moduleError/);
  assert.match(source, /if \(moduleError\)\s*\{\s*throw new Error/);
  assert.doesNotMatch(source, /const \{ data: moduleRows \} =/);
});
