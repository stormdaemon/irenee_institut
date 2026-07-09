import { withTransaction } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProfileAdministrationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProfileAdministrationError";
    this.status = status;
  }
}

function uniqueCourseIds(values: unknown[]) {
  if (values.length > 100) throw new ProfileAdministrationError("Trop de cours ont été sélectionnés.");
  const ids = [...new Set(values.map(value => String(value || "").trim()))];
  if (ids.some(id => !UUID_PATTERN.test(id))) throw new ProfileAdministrationError("Un identifiant de cours est invalide.");
  return ids;
}

export async function replaceManualCourseEnrollments(studentId: string, values: unknown[]) {
  if (!UUID_PATTERN.test(studentId)) throw new ProfileAdministrationError("L'identifiant utilisateur est invalide.");
  const courseIds = uniqueCourseIds(values);

  return withTransaction(async client => {
    const student = await client.query<{ role: string }>("select role from public.profiles where id=$1 for update", [studentId]);
    if (!student.rows[0]) throw new ProfileAdministrationError("L'utilisateur est introuvable.", 404);
    if (student.rows[0].role !== "etudiant") {
      throw new ProfileAdministrationError("Les cours ne peuvent être attribués qu'à un étudiant.", 409);
    }

    if (courseIds.length) {
      const existingCourses = await client.query<{ id: string }>(
        "select id from public.courses where id=any($1::uuid[]) for share",
        [courseIds]
      );
      if (existingCourses.rows.length !== courseIds.length) {
        throw new ProfileAdministrationError("Un ou plusieurs cours sont introuvables.", 409);
      }
      await client.query(
        `delete from public.course_enrollments
         where etudiant_id=$1 and access_source='legacy' and not (course_id=any($2::uuid[]))`,
        [studentId, courseIds]
      );
      await client.query(
        `insert into public.course_enrollments
          (etudiant_id,course_id,statut,access_source,access_expires_at,updated_at)
         select $1,selected.course_id,'en_cours','legacy',null,now()
         from unnest($2::uuid[]) selected(course_id)
         where not exists (
           select 1 from public.course_enrollments existing
           where existing.etudiant_id=$1 and existing.course_id=selected.course_id
         )
         on conflict (etudiant_id,course_id) do nothing`,
        [studentId, courseIds]
      );
    } else {
      await client.query(
        "delete from public.course_enrollments where etudiant_id=$1 and access_source='legacy'",
        [studentId]
      );
    }

    const result = await client.query<Record<string, unknown>>(
      "select * from public.course_enrollments where etudiant_id=$1 order by created_at,id",
      [studentId]
    );
    const available = new Set(result.rows.map(row => String(row.course_id)));
    if (courseIds.some(id => !available.has(id))) {
      throw new ProfileAdministrationError("L'attribution des cours n'a pas pu être vérifiée.", 409);
    }
    return result.rows;
  });
}
