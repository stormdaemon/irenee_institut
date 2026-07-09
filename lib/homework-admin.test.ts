import assert from "node:assert/strict";
import { test } from "node:test";
import { HomeworkInputError, parseHomeworkForm, parseHomeworkReview } from "./homework-admin";

const courseId = "00000000-0000-4000-8000-000000000101";
const studentId = "00000000-0000-4000-8000-000000000102";

test("homework creation input is normalized and deduplicates students", () => {
  const form = new FormData();
  form.set("course_id", courseId);
  form.set("titre", "  Dissertation   finale ");
  form.set("description", "Consignes détaillées");
  form.set("date_limite", "2026-09-20T20:30");
  form.append("student_ids", studentId);
  form.append("student_ids", studentId);

  assert.deepEqual(parseHomeworkForm(form), {
    courseId,
    deadline: "2026-09-20T20:30:00.000Z",
    description: "Consignes détaillées",
    studentIds: [studentId],
    title: "Dissertation finale"
  });
});

test("homework creation rejects malformed identifiers and missing students", () => {
  const form = new FormData();
  form.set("course_id", "not-a-uuid");
  form.set("titre", "Devoir");
  form.set("description", "Consignes");
  assert.throws(() => parseHomeworkForm(form), HomeworkInputError);

  form.set("course_id", courseId);
  assert.throws(() => parseHomeworkForm(form), /Au moins un étudiant/);
});

test("homework review only accepts bounded pedagogical fields", () => {
  assert.deepEqual(parseHomeworkReview({ feedback: "  Bon travail. ", grade: 17.5, statut: "corrige" }), {
    feedback: "Bon travail.",
    grade: 17.5,
    statut: "corrige"
  });
  assert.throws(() => parseHomeworkReview({ grade: 21 }), HomeworkInputError);
  assert.throws(() => parseHomeworkReview({ statut: "admin" }), HomeworkInputError);
  assert.throws(() => parseHomeworkReview({ unknown: true }), HomeworkInputError);
});
