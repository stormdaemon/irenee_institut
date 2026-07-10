import type { PoolClient } from "pg";
import type { ParsedCourseModule, parseCourseForm } from "./course-input";
import { validatePublishedCaptionResources } from "./course-caption-validation";
import { withTransaction } from "./db";

type ParsedCourse = ReturnType<typeof parseCourseForm>;

type CourseActor = {
  id: string;
  email: string;
  nom?: string | null;
  prenom?: string | null;
  role: "directeur" | "formateur";
};

type CourseRow = Record<string, unknown> & {
  id: string;
  slug: string;
  auteur_id?: string | null;
  updated_at?: Date | string;
  updated_at_token?: string;
  version_matches?: boolean;
};
type ModuleRow = Record<string, unknown> & { id: string; course_id: string };

export class CoursePersistenceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CoursePersistenceError";
    this.status = status;
  }
}

const courseColumns = [
  "titre", "slug", "description", "image_url", "niveau", "objectifs", "competences", "prerequis",
  "semestre", "numero", "duree_totale_minutes", "duree_totale", "prix", "prix_reduit",
  "url_paiement_paypal", "statut"
] as const;

function courseValues(course: ParsedCourse["course"]) {
  return courseColumns.map(column => course[column]);
}

function moduleValues(courseId: string, module: ParsedCourseModule) {
  return [
    courseId,
    module.titre,
    module.description,
    module.ordre,
    module.duree,
    module.type_contenu,
    module.contenu_html,
    module.contenu,
    module.url_video,
    module.url_sous_titres ?? null,
    JSON.stringify(module.quiz ?? [])
  ];
}

async function insertModule(client: PoolClient, courseId: string, module: ParsedCourseModule) {
  const result = await client.query<ModuleRow>(
    `insert into public.course_modules
      (course_id,titre,description,ordre,duree,type_contenu,contenu_html,contenu,url_video,url_sous_titres,quiz)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     returning *`,
    moduleValues(courseId, module)
  );
  return result.rows[0];
}

async function readCompleteCourse(client: PoolClient, id: string) {
  const courseResult = await client.query<CourseRow>(
    `select courses.*,
            to_char(courses.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at_token
     from public.courses courses where id = $1`,
    [id]
  );
  if (!courseResult.rows[0]) throw new CoursePersistenceError("Cours introuvable.", 404);
  const moduleResult = await client.query<ModuleRow>(
    "select * from public.course_modules where course_id = $1 order by ordre asc",
    [id]
  );
  const { updated_at_token: updatedAtToken, ...course } = courseResult.rows[0];
  return { ...course, updated_at: updatedAtToken || course.updated_at, course_modules: moduleResult.rows };
}

export async function createCourse(input: ParsedCourse, actor: CourseActor) {
  await validatePublishedCaptionResources(input);
  return withTransaction(async client => {
    const authorName = `${actor.prenom || ""} ${actor.nom || ""}`.trim() || actor.email;
    const placeholders = courseColumns.map((_, index) => `$${index + 1}`);
    const result = await client.query<CourseRow>(
      `insert into public.courses (${courseColumns.join(",")},auteur_id,auteur_nom,nb_modules)
       values (${placeholders.join(",")},$${courseColumns.length + 1},$${courseColumns.length + 2},0)
       returning *`,
      [...courseValues(input.course), actor.id, authorName]
    );
    const course = result.rows[0];
    for (const module of input.modules) await insertModule(client, course.id, module);
    return readCompleteCourse(client, course.id);
  });
}

export async function updateCourse(id: string, input: ParsedCourse, actor: CourseActor) {
  await validatePublishedCaptionResources(input);
  return withTransaction(async client => {
    const existing = await client.query<CourseRow>(
      `select courses.*, (courses.updated_at = $2::timestamptz) as version_matches
       from public.courses courses where id = $1 for update`,
      [id, input.expectedUpdatedAt]
    );
    const current = existing.rows[0];
    if (!current) throw new CoursePersistenceError("Cours introuvable.", 404);
    if (actor.role !== "directeur" && current.auteur_id !== actor.id) {
      throw new CoursePersistenceError("Vous ne pouvez modifier que vos propres cours.", 403);
    }
    if (!input.expectedUpdatedAt) {
      throw new CoursePersistenceError("Le cours doit être rechargé avant de pouvoir être modifié.", 409);
    }
    if (current.version_matches !== true) {
      throw new CoursePersistenceError("Ce cours a été modifié dans un autre onglet ou par une autre personne. Rechargez-le avant de continuer.", 409);
    }

    const submittedIds = input.modules.flatMap(module => module.id ? [module.id] : []);
    if (submittedIds.length) {
      const owned = await client.query<{ id: string }>(
        "select id from public.course_modules where course_id = $1 and id = any($2::uuid[]) for update",
        [id, submittedIds]
      );
      if (owned.rows.length !== new Set(submittedIds).size) {
        throw new CoursePersistenceError("Un module soumis n'appartient pas à ce cours.", 409);
      }
    }

    const assignments = courseColumns.map((column, index) => `${column} = $${index + 1}`);
    const courseUpdate = await client.query<{ id: string }>(
      `update public.courses
       set ${assignments.join(",")}, updated_at = now()
       where id = $${courseColumns.length + 1}
         and updated_at = $${courseColumns.length + 2}::timestamptz
       returning id`,
      [...courseValues(input.course), id, input.expectedUpdatedAt]
    );
    if (courseUpdate.rows.length !== 1) {
      throw new CoursePersistenceError("Ce cours a été modifié dans un autre onglet ou par une autre personne. Rechargez-le avant de continuer.", 409);
    }

    // Move existing positions out of the unique range before applying a reordered list.
    await client.query("update public.course_modules set ordre = ordre + 10000 where course_id = $1", [id]);
    if (submittedIds.length) {
      await client.query("delete from public.course_modules where course_id = $1 and not (id = any($2::uuid[]))", [id, submittedIds]);
    } else {
      await client.query("delete from public.course_modules where course_id = $1", [id]);
    }

    for (const module of input.modules) {
      if (!module.id) {
        await insertModule(client, id, module);
        continue;
      }
      const result = await client.query<ModuleRow>(
        `update public.course_modules
         set titre=$1,description=$2,ordre=$3,duree=$4,type_contenu=$5,contenu_html=$6,contenu=$7,url_video=$8,
             url_sous_titres=case when $9::boolean then $10 else url_sous_titres end,
             quiz=coalesce($11::jsonb,quiz),updated_at=greatest(now(),updated_at + interval '1 millisecond')
         where id=$12 and course_id=$13 returning *`,
        [
          module.titre,
          module.description,
          module.ordre,
          module.duree,
          module.type_contenu,
          module.contenu_html,
          module.contenu,
          module.url_video,
          Object.hasOwn(module, "url_sous_titres"),
          module.url_sous_titres ?? null,
          module.quiz === undefined ? null : JSON.stringify(module.quiz),
          module.id,
          id
        ]
      );
      if (result.rows.length !== 1) throw new CoursePersistenceError("Un module n'a pas pu être mis à jour.", 409);
    }

    return readCompleteCourse(client, id);
  });
}
