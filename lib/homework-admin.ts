import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reviewStatuses = new Set(["assigne", "soumis", "corrige", "a_revoir"]);
const reviewFields = new Set(["feedback", "grade", "statut"]);

export class HomeworkInputError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HomeworkInputError";
    this.status = status;
  }
}

function boundedText(value: unknown, label: string, maximum: number) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) throw new HomeworkInputError(`${label} est requis.`);
  if (normalized.length > maximum) throw new HomeworkInputError(`${label} est trop long.`);
  return normalized;
}

function validUuid(value: unknown, label: string) {
  const normalized = String(value || "").trim();
  if (!UUID_PATTERN.test(normalized)) throw new HomeworkInputError(`${label} est invalide.`);
  return normalized;
}

function normalizeDeadline(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/.test(raw)) {
    throw new HomeworkInputError("La date limite est invalide.");
  }
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new HomeworkInputError("La date limite est invalide.");
  return date.toISOString();
}

export function parseHomeworkForm(form: FormData) {
  const studentIds = [...new Set(form.getAll("student_ids").map((value, index) => validUuid(value, `L'étudiant ${index + 1}`)))];
  if (!studentIds.length) throw new HomeworkInputError("Au moins un étudiant doit être sélectionné.");
  if (studentIds.length > 500) throw new HomeworkInputError("Trop d'étudiants ont été sélectionnés.");
  return {
    courseId: validUuid(form.get("course_id"), "Le cours"),
    deadline: normalizeDeadline(form.get("date_limite")),
    description: boundedText(form.get("description"), "La description", 20_000),
    studentIds,
    title: boundedText(form.get("titre"), "Le titre", 240)
  };
}

export function parseHomeworkReview(body: Record<string, unknown>) {
  const submittedKeys = Object.keys(body);
  if (!submittedKeys.length || submittedKeys.some(key => !reviewFields.has(key))) {
    throw new HomeworkInputError("La modification demandée n'est pas autorisée.");
  }

  const payload: { feedback?: string; grade?: number | null; statut?: string } = {};
  if (body.feedback !== undefined) {
    const feedback = String(body.feedback ?? "").trim();
    if (feedback.length > 20_000) throw new HomeworkInputError("Le retour pédagogique est trop long.");
    payload.feedback = feedback;
  }
  if (body.grade !== undefined) {
    if (body.grade === null || body.grade === "") {
      payload.grade = null;
    } else {
      const grade = Number(body.grade);
      if (!Number.isFinite(grade) || grade < 0 || grade > 20 || Math.round(grade * 100) !== grade * 100) {
        throw new HomeworkInputError("La note doit être comprise entre 0 et 20.");
      }
      payload.grade = grade;
    }
  }
  if (body.statut !== undefined) {
    const status = String(body.statut);
    if (!reviewStatuses.has(status)) throw new HomeworkInputError("Le statut du devoir est invalide.");
    payload.statut = status;
  }
  return payload;
}

type StaffActor = {
  id: string;
  email?: string | null;
  nom?: string | null;
  prenom?: string | null;
  role: "directeur" | "formateur";
};

export type HomeworkCreationInput = ReturnType<typeof parseHomeworkForm>;

async function assertCourseAuthority(client: PoolClient, courseId: string, actor: StaffActor) {
  const result = await client.query<{ auteur_id: string | null }>(
    "select auteur_id from public.courses where id=$1 for share",
    [courseId]
  );
  if (!result.rows[0]) throw new HomeworkInputError("Le cours est introuvable.", 404);
  if (actor.role === "formateur" && result.rows[0].auteur_id !== actor.id) {
    throw new HomeworkInputError("Vous ne pouvez créer un devoir que pour vos propres cours.", 403);
  }
}

export async function createHomework(input: HomeworkCreationInput, actor: StaffActor) {
  return withTransaction(async client => {
    await assertCourseAuthority(client, input.courseId, actor);
    const students = await client.query<{ id: string }>(
      "select id from public.profiles where role='etudiant' and id = any($1::uuid[]) for share",
      [input.studentIds]
    );
    if (students.rows.length !== input.studentIds.length) {
      throw new HomeworkInputError("Un ou plusieurs étudiants sélectionnés sont invalides.", 409);
    }

    const authorName = `${actor.prenom || ""} ${actor.nom || ""}`.trim() || actor.email || "Formateur";
    const homework = await client.query<Record<string, unknown>>(
      `insert into public.homework (course_id,titre,description,auteur_id,auteur_nom,date_limite,updated_at)
       values ($1,$2,$3,$4,$5,$6,now()) returning *`,
      [input.courseId, input.title, input.description, actor.id, authorName, input.deadline]
    );
    const homeworkId = String(homework.rows[0].id);
    const assignments = await client.query<Record<string, unknown>>(
      `insert into public.homework_assignments (homework_id,etudiant_id)
       select $1, unnest($2::uuid[]) returning *`,
      [homeworkId, input.studentIds]
    );
    return { ...homework.rows[0], homework_assignments: assignments.rows };
  });
}

export async function reviewHomeworkAssignment(
  assignmentId: string,
  input: ReturnType<typeof parseHomeworkReview>,
  actor: StaffActor
) {
  validUuid(assignmentId, "L'assignation");
  return withTransaction(async client => {
    const existing = await client.query<{ auteur_id: string; id: string }>(
      `select assignment.id,homework.auteur_id
       from public.homework_assignments assignment
       join public.homework homework on homework.id=assignment.homework_id
       where assignment.id=$1 for update of assignment`,
      [assignmentId]
    );
    if (!existing.rows[0]) throw new HomeworkInputError("L'assignation est introuvable.", 404);
    if (actor.role === "formateur" && existing.rows[0].auteur_id !== actor.id) {
      throw new HomeworkInputError("Vous ne pouvez corriger que les devoirs dont vous êtes l'auteur.", 403);
    }

    const fields = Object.keys(input) as (keyof typeof input)[];
    const values = fields.map(key => input[key]);
    const assignments = fields.map((key, index) => `${key}=$${index + 1}`);
    const result = await client.query<Record<string, unknown>>(
      `update public.homework_assignments
       set ${assignments.join(",")},updated_at=now()
       where id=$${fields.length + 1} returning *`,
      [...values, assignmentId]
    );
    return result.rows[0];
  });
}
