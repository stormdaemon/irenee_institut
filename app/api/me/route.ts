import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
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
    quiz: module.quiz
  };
}

function profileFromUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Profile {
  const metadata = user.user_metadata || {};
  const email = user.email || "";
  const marketingOptIn = metadata.marketing_opt_in !== false;
  return {
    id: user.id,
    email,
    prenom: String(metadata.prenom || metadata.first_name || email.split("@")[0] || ""),
    nom: String(metadata.nom || metadata.last_name || ""),
    role: "etudiant",
    statut_inscription: "en_attente",
    marketing_opt_in: marketingOptIn,
    marketing_opt_in_at: marketingOptIn ? new Date().toISOString() : null,
    marketing_opt_out_at: marketingOptIn ? null : new Date().toISOString()
  };
}

export async function GET(request: Request) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Vous devez être connecté pour accéder à cet espace." }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: authError?.message || "Session invalide ou expirée." }, { status: 401 });
  }

  const user = authData.user;
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
  const { data: enrollments, error: enrollmentError } = isStaff
    ? { data: [], error: null }
    : await supabase
      .from("course_enrollments")
      .select("*")
      .eq("etudiant_id", user.id);

  if (enrollmentError) {
    return NextResponse.json({ ok: false, error: enrollmentError.message }, { status: 400 });
  }

  let courseIds = [...new Set((enrollments || []).map(item => item.course_id).filter(Boolean))];

  if (isStaff) {
    const { data: staffCourseRows, error: staffCourseError } = await supabase
      .from("courses")
      .select("id")
      .order("numero", { ascending: true });

    if (staffCourseError) {
      return NextResponse.json({ ok: false, error: staffCourseError.message }, { status: 400 });
    }

    courseIds = [...new Set((staffCourseRows || []).map(item => item.id).filter(Boolean))];
  }
  let courses: (Course & { enrollment_id?: string; progress?: number; completedModules?: number })[] = [];
  let progressRows: { module_id: string; course_id?: string | null; progression?: number | null; complete?: boolean | null }[] = [];

  if (courseIds.length) {
    const [{ data: courseRows, error: courseError }, { data: moduleRows, error: moduleError }, { data: progressData }] = await Promise.all([
      supabase.from("courses").select("*").in("id", courseIds).order("numero", { ascending: true }),
      supabase.from("course_modules").select("*").in("course_id", courseIds).order("ordre", { ascending: true }),
      supabase.from("module_progress").select("*").eq("etudiant_id", user.id)
    ]);

    if (courseError) return NextResponse.json({ ok: false, error: courseError.message }, { status: 400 });
    if (moduleError) return NextResponse.json({ ok: false, error: moduleError.message }, { status: 400 });

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
    .eq("student_id", user.id);

  const homeworkIds = [...new Set((assignmentRows || []).map(item => item.homework_id).filter(Boolean))];
  let homework: Homework[] = [];

  if (homeworkIds.length) {
    const { data: homeworkRows } = await supabase.from("homework").select("*").in("id", homeworkIds);
    const homeworkById = new Map((homeworkRows || []).map(item => [item.id, item as Homework]));
    homework = (assignmentRows || [])
      .map(item => homeworkById.get(item.homework_id))
      .filter(Boolean) as Homework[];
  }

  return NextResponse.json({
    ok: true,
    profile,
    courses,
    homework,
    progress: progressRows
  });
}
