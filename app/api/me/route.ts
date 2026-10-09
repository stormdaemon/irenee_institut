import { pgInsert, pgRead } from "@/lib/postgres";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { isActiveCourseEnrollment } from "@/lib/learning-security";
import type { Course, CourseModule, Homework, Profile } from "@/lib/types";

type RawCourse = Omit<Course, "modules" | "objectifs" | "competences" | "prerequis"> & {
  objectifs?: string[] | null;
  competences?: string[] | null;
  prerequis?: string[] | null;
  duree?: number | null;
};

type RawModule = CourseModule & {
  type_contenu?: string | null;
};

const privateNoStoreHeaders = { "Cache-Control": "private, no-store" };

function privateJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { headers: privateNoStoreHeaders, status });
}

function normalizeCourse(course: RawCourse, modules: CourseModule[]): Course {
  return {
    ...course,
    description: course.description || "",
    niveau: course.niveau || "debutant",
    duree_totale: Number(course.duree_totale_minutes || course.duree_totale || course.duree || 0),
    nb_modules: Number(course.nb_modules || modules.length),
    prix: Number(course.prix || 0),
    prix_reduit: Number(course.prix_reduit || 0),
    objectifs: Array.isArray(course.objectifs) ? course.objectifs : [],
    competences: Array.isArray(course.competences) ? course.competences : [],
    prerequis: Array.isArray(course.prerequis) ? course.prerequis : [],
    modules
  };
}

function normalizeModule(module: RawModule): CourseModule {
  return {
    id: module.id,
    course_id: module.course_id,
    titre: module.titre,
    description: module.description || "",
    ordre: module.ordre || 0,
    duree: Number(module.duree || 0),
    type: module.type_contenu || module.type || "texte",
    type_contenu: module.type_contenu
  };
}

function profileFromUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Profile {
  const metadata = user.user_metadata || {};
  const email = user.email || "";
  return {
    id: user.id,
    email,
    prenom: String(metadata.prenom || metadata.first_name || email.split("@")[0] || ""),
    nom: String(metadata.nom || metadata.last_name || ""),
    role: "etudiant",
    statut_inscription: "en_attente"
  };
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { context, user } = auth;
  const fallbackProfile = profileFromUser(user);
  let { data: profile, error: profileError } = await pgRead("select t.* from public.\"profiles\" t where t.\"id\" = $1", [user.id], "optional");

  if (profileError) {
    return privateJson({ ok: false, error: profileError.message }, 400);
  }

  if (!profile) {
    const { data: createdProfile, error: createProfileError } = await pgInsert("profiles", { ...fallbackProfile, updated_at: new Date().toISOString() }, { returning: "one", conflict: ["id"] });

    if (createProfileError) {
      return privateJson({ ok: false, error: createProfileError.message }, 400);
    }

    profile = createdProfile;
  }

  if (!profile) return privateJson({ ok: false, error: "Profil indisponible." }, 503);
  const isStaff = profile.role === "directeur" || profile.role === "formateur";
  const { data: annualPass, error: annualPassError } = isStaff
    ? { data: null, error: null }
    : await pgRead("select t.\"id\", t.\"status\", t.\"expires_at\" from public.\"annual_access_passes\" t where t.\"user_id\" = $1 and t.\"status\" = $2 and t.\"expires_at\" > $3 order by t.\"expires_at\" desc limit $4", [user.id, "active", new Date().toISOString(), 1], "optional");

  if (annualPassError) {
    return privateJson({ ok: false, error: annualPassError.message }, 400);
  }

  const enrollmentResult = isStaff
    ? { data: [], error: null }
    : await pgRead("select t.\"id\", t.\"course_id\", t.\"statut\", t.\"access_source\", t.\"access_expires_at\" from public.\"course_enrollments\" t where t.\"etudiant_id\" = $1 and t.\"statut\" = $2", [user.id, "en_cours"], "many");

  if (enrollmentResult.error) {
    return privateJson({ ok: false, error: enrollmentResult.error.message }, 400);
  }
  const enrollments = (enrollmentResult.data || []).filter(enrollment => isActiveCourseEnrollment({
    accessExpiresAt: enrollment.access_expires_at,
    accessSource: enrollment.access_source,
    activeAnnualPass: Boolean(annualPass),
    status: enrollment.statut
  }));

  let courseIds = [...new Set(enrollments.map(item => item.course_id).filter(Boolean))];

  if (isStaff || annualPass) {
    const { data: staffCourseRows, error: staffCourseError } = await pgRead("select t.\"id\" from public.\"courses\" t where t.\"statut\" = $1 order by t.\"numero\" asc", ["publie"], "many");

    if (staffCourseError) {
      return NextResponse.json({ ok: false, error: staffCourseError.message }, { status: 400 });
    }

    courseIds = [...new Set((staffCourseRows || []).map(item => item.id).filter(Boolean))];
  }
  let courses: (Course & { enrollment_id?: string; progress?: number; completedModules?: number })[] = [];
  let progressRows: { module_id: string; course_id?: string | null; progression?: number | null; complete?: boolean | null }[] = [];

  if (courseIds.length) {
    const { data: courseRows, error: courseError } = await pgRead("select t.\"id\", t.\"titre\", t.\"slug\", t.\"description\", t.\"image_url\", t.\"objectifs\", t.\"competences\", t.\"prerequis\", t.\"semestre\", t.\"numero\", t.\"duree\", t.\"niveau\", t.\"statut\", t.\"nb_modules\", t.\"duree_totale_minutes\", t.\"duree_totale\", t.\"prix\", t.\"prix_reduit\" from public.\"courses\" t where t.\"id\" = any($1) and t.\"statut\" = $2 order by t.\"numero\" asc", [courseIds, "publie"], "many");
    if (courseError) return privateJson({ ok: false, error: courseError.message }, 400);

    const accessibleCourseIds = (courseRows || []).map(course => course.id);
    const { data: moduleRows, error: moduleError } = accessibleCourseIds.length
      ? await pgRead("select t.\"id\", t.\"course_id\", t.\"titre\", t.\"description\", t.\"ordre\", t.\"duree\", t.\"type_contenu\" from public.\"course_modules\" t where t.\"course_id\" = any($1) order by t.\"ordre\" asc", [accessibleCourseIds], "many")
      : { data: [], error: null };
    if (moduleError) return privateJson({ ok: false, error: moduleError.message }, 400);

    const accessibleModuleIds = (moduleRows || []).map(module => module.id);
    const { data: progressData, error: progressError } = accessibleModuleIds.length
      ? await pgRead("select t.\"module_id\", t.\"course_id\", t.\"progression\", t.\"complete\", t.\"date_completion\", t.\"statut\" from public.\"module_progress\" t where t.\"etudiant_id\" = $1 and t.\"module_id\" = any($2)", [user.id, accessibleModuleIds], "many")
      : { data: [], error: null };
    if (progressError) return privateJson({ ok: false, error: progressError.message }, 400);

    progressRows = (progressData || []) as typeof progressRows;
    const progressByModule = new Map(progressRows.map(row => [row.module_id, row]));
    const modulesByCourse = new Map<string, CourseModule[]>();

    for (const row of (moduleRows || []) as RawModule[]) {
      const list = modulesByCourse.get(row.course_id || "") || [];
      list.push(normalizeModule(row));
      modulesByCourse.set(row.course_id || "", list);
    }

    const enrollmentByCourse = new Map(enrollments.map(item => [item.course_id, item]));
    courses = ((courseRows || []) as RawCourse[]).map(course => {
      const modules = modulesByCourse.get(course.id) || [];
      const completedModules = modules.filter(module => progressByModule.get(module.id)?.complete === true).length;
      const resumeModuleId = modules.find(module => progressByModule.get(module.id)?.complete !== true)?.id || modules.at(-1)?.id || null;
      const progress = modules.length
        ? Math.round(modules.reduce((sum, module) => {
          const row = progressByModule.get(module.id);
          return sum + (row?.complete ? 100 : Number(row?.progression || 0));
        }, 0) / modules.length)
        : 0;

      return {
        ...normalizeCourse(course, modules),
        enrollment_id: enrollmentByCourse.get(course.id)?.id,
        progress,
        completedModules,
        resumeModuleId
      };
    });
  }

  const { data: assignmentRows } = await pgRead("select t.* from public.\"homework_assignments\" t where t.\"etudiant_id\" = $1", [user.id], "many");

  const assignments = assignmentRows || [];
  const homeworkIds = [...new Set(assignments.map(item => item.homework_id).filter(Boolean))];
  let homework: Homework[] = [];

  if (homeworkIds.length) {
    const { data: homeworkRows } = await pgRead("select t.* from public.\"homework\" t where t.\"id\" = any($1)", [homeworkIds], "many");
    const homeworkById = new Map((homeworkRows || []).map(item => [item.id, item as Homework]));
    homework = assignments
      .map(item => homeworkById.get(item.homework_id))
      .filter(Boolean) as Homework[];
  }

  const [
    { data: learningDocuments, error: documentsError },
    { data: latestExamAttempt, error: examError },
    { data: libraryMembership, error: libraryMembershipError },
    { data: bookRequests, error: bookRequestsError }
  ] = await Promise.all([
    pgRead("select t.* from public.\"learning_documents\" t where t.\"user_id\" = $1 order by t.\"issued_at\" desc", [user.id], "many"),
    pgRead("select t.\"score\", t.\"passed\", t.\"created_at\" from public.\"final_exam_attempts\" t where t.\"user_id\" = $1 order by t.\"created_at\" desc limit $2", [user.id, 1], "optional"),
    pgRead("select t.* from public.\"library_memberships\" t where t.\"user_id\" = $1 and t.\"status\" = $2 and t.\"expires_at\" > $3 order by t.\"expires_at\" desc limit $4", [user.id, "active", new Date().toISOString(), 1], "optional"),
    pgRead("select t.* from public.\"book_requests\" t where t.\"user_id\" = $1 order by t.\"requested_at\" desc", [user.id], "many")
  ]);

  if (documentsError) return privateJson({ ok: false, error: documentsError.message }, 400);
  if (examError) return privateJson({ ok: false, error: examError.message }, 400);
  if (libraryMembershipError) return privateJson({ ok: false, error: libraryMembershipError.message }, 400);
  if (bookRequestsError) return privateJson({ ok: false, error: bookRequestsError.message }, 400);

  const curriculumCompleted = Boolean(annualPass) && courses.length > 0 && courses.every(course => course.modules.length > 0 && course.completedModules === course.modules.length);

  return privateJson({
    annualPass,
    curriculum: {
      completed: curriculumCompleted,
      completedCourses: courses.filter(course => course.modules.length > 0 && course.completedModules === course.modules.length).length,
      totalCourses: courses.length
    },
    documents: learningDocuments || [],
    libraryMembership: libraryMembership || null,
    bookRequests: bookRequests || [],
    finalExam: {
      eligible: curriculumCompleted,
      latestAttempt: latestExamAttempt || null
    },
    ok: true,
    profile,
    courses,
    homework,
    progress: progressRows
  });
}
