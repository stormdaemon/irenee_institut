import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { projectPublicQuiz } from "@/lib/learning-projection";
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
    type_contenu: module.type_contenu,
    contenu: module.contenu,
    contenu_html: module.contenu_html || module.contenu || "",
    url_video: module.url_video,
    ressources: module.ressources,
    quiz: projectPublicQuiz(module.quiz)
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
  const { supabase, user } = auth;
  const fallbackProfile = profileFromUser(user);
  let { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 400 });
  }

  if (!profile) {
    const { data: createdProfile, error: createProfileError } = await supabase
      .from("profiles")
      .upsert({ ...fallbackProfile, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (createProfileError) {
      return NextResponse.json({ ok: false, error: createProfileError.message }, { status: 400 });
    }

    profile = createdProfile;
  }

  const isStaff = profile.role === "directeur" || profile.role === "formateur";
  const { data: annualPass, error: annualPassError } = isStaff
    ? { data: null, error: null }
    : await supabase
      .from("annual_access_passes")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (annualPassError) {
    return NextResponse.json({ ok: false, error: annualPassError.message }, { status: 400 });
  }

  const enrollmentResult = isStaff
    ? { data: [], error: null }
    : await supabase
      .from("course_enrollments")
      .select("*")
      .eq("etudiant_id", user.id)
      .eq("statut", "en_cours");

  if (enrollmentResult.error) {
    return NextResponse.json({ ok: false, error: enrollmentResult.error.message }, { status: 400 });
  }
  const enrollments = (enrollmentResult.data || []).filter(enrollment => isActiveCourseEnrollment({
    accessExpiresAt: enrollment.access_expires_at,
    accessSource: enrollment.access_source,
    activeAnnualPass: Boolean(annualPass),
    status: enrollment.statut
  }));

  let courseIds = [...new Set(enrollments.map(item => item.course_id).filter(Boolean))];

  if (isStaff || annualPass) {
    const { data: staffCourseRows, error: staffCourseError } = await supabase
      .from("courses")
      .select("id")
      .eq("statut", "publie")
      .order("numero", { ascending: true });

    if (staffCourseError) {
      return NextResponse.json({ ok: false, error: staffCourseError.message }, { status: 400 });
    }

    courseIds = [...new Set((staffCourseRows || []).map(item => item.id).filter(Boolean))];
  }
  let courses: (Course & { enrollment_id?: string; progress?: number; completedModules?: number })[] = [];
  let progressRows: { module_id: string; course_id?: string | null; progression?: number | null; complete?: boolean | null }[] = [];

  if (courseIds.length) {
    const { data: courseRows, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .in("id", courseIds)
      .eq("statut", "publie")
      .order("numero", { ascending: true });
    if (courseError) return NextResponse.json({ ok: false, error: courseError.message }, { status: 400 });

    const accessibleCourseIds = (courseRows || []).map(course => course.id);
    const { data: moduleRows, error: moduleError } = accessibleCourseIds.length
      ? await supabase
        .from("course_modules")
        .select("*")
        .in("course_id", accessibleCourseIds)
        .order("ordre", { ascending: true })
      : { data: [], error: null };
    if (moduleError) return NextResponse.json({ ok: false, error: moduleError.message }, { status: 400 });

    const accessibleModuleIds = (moduleRows || []).map(module => module.id);
    const { data: progressData, error: progressError } = accessibleModuleIds.length
      ? await supabase
        .from("module_progress")
        .select("*")
        .eq("etudiant_id", user.id)
        .in("module_id", accessibleModuleIds)
      : { data: [], error: null };
    if (progressError) return NextResponse.json({ ok: false, error: progressError.message }, { status: 400 });

    progressRows = (progressData || []) as typeof progressRows;
    const progressByModule = new Map(progressRows.map(row => [row.module_id, row]));
    const modulesByCourse = new Map<string, CourseModule[]>();

    for (const row of (moduleRows || []) as RawModule[]) {
      const list = modulesByCourse.get(row.course_id || "") || [];
      list.push(normalizeModule(row));
      modulesByCourse.set(row.course_id || "", list);
    }

    const enrollmentByCourse = new Map((enrollments || []).map(item => [item.course_id, item]));
    courses = ((courseRows || []) as RawCourse[]).map(course => {
      const modules = modulesByCourse.get(course.id) || [];
      const completedModules = modules.filter(module => progressByModule.get(module.id)?.complete || Number(progressByModule.get(module.id)?.progression || 0) >= 100).length;
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
        completedModules
      };
    });
  }

  const { data: assignmentRows } = await supabase
    .from("homework_assignments")
    .select("*")
    .eq("etudiant_id", user.id);

  const homeworkIds = [...new Set((assignmentRows || []).map(item => item.homework_id).filter(Boolean))];
  let homework: Homework[] = [];

  if (homeworkIds.length) {
    const { data: homeworkRows } = await supabase.from("homework").select("*").in("id", homeworkIds);
    const homeworkById = new Map((homeworkRows || []).map(item => [item.id, item as Homework]));
    homework = (assignmentRows || [])
      .map(item => homeworkById.get(item.homework_id))
      .filter(Boolean) as Homework[];
  }

  const [
    { data: learningDocuments, error: documentsError },
    { data: latestExamAttempt, error: examError },
    { data: libraryMembership, error: libraryMembershipError },
    { data: bookRequests, error: bookRequestsError }
  ] = await Promise.all([
    supabase
      .from("learning_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("issued_at", { ascending: false }),
    supabase
      .from("final_exam_attempts")
      .select("score, passed, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("library_memberships")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("book_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
  ]);

  if (documentsError) return NextResponse.json({ ok: false, error: documentsError.message }, { status: 400 });
  if (examError) return NextResponse.json({ ok: false, error: examError.message }, { status: 400 });
  if (libraryMembershipError) return NextResponse.json({ ok: false, error: libraryMembershipError.message }, { status: 400 });
  if (bookRequestsError) return NextResponse.json({ ok: false, error: bookRequestsError.message }, { status: 400 });

  const curriculumCompleted = Boolean(annualPass) && courses.length > 0 && courses.every(course => course.modules.length > 0 && course.completedModules === course.modules.length);

  return NextResponse.json({
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
