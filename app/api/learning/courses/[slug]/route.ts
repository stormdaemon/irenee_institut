import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { hasPublishedCourseAccess, isActiveCourseEnrollment } from "@/lib/learning-security";
import { resolveNextPublishedCourse } from "@/lib/course-navigation";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const privateNoStoreHeaders = { "Cache-Control": "private, no-store" };

function privateJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { headers: privateNoStoreHeaders, status });
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { slug } = await params;
  if (!slugPattern.test(slug)) {
    return privateJson({ ok: false, error: "Cours introuvable." }, 404);
  }

  const now = new Date().toISOString();
  const [profileResult, courseResult, annualPassResult] = await Promise.all([
    auth.supabase.from("profiles").select("id,email,prenom,nom,role").eq("id", auth.user.id).maybeSingle(),
    auth.supabase
      .from("courses")
      .select("id,titre,slug,description,image_url,objectifs,competences,prerequis,semestre,numero,duree,niveau,statut,nb_modules,duree_totale_minutes,duree_totale,prix,prix_reduit")
      .eq("slug", slug)
      .eq("statut", "publie")
      .maybeSingle(),
    auth.supabase
      .from("annual_access_passes")
      .select("id,expires_at")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .gt("expires_at", now)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  if (profileResult.error || courseResult.error || annualPassResult.error) {
    return privateJson({ ok: false, error: "Impossible de vérifier l'accès au cours." }, 500);
  }
  if (!profileResult.data || !courseResult.data) {
    return privateJson({ ok: false, error: "Cours introuvable." }, 404);
  }

  const enrollmentResult = await auth.supabase
    .from("course_enrollments")
    .select("id,statut,access_source,access_expires_at")
    .eq("etudiant_id", auth.user.id)
    .eq("course_id", courseResult.data.id)
    .eq("statut", "en_cours")
    .maybeSingle();
  if (enrollmentResult.error) {
    return privateJson({ ok: false, error: "Impossible de vérifier l'accès au cours." }, 500);
  }

  const activeAnnualPass = Boolean(annualPassResult.data);
  const activeEnrollment = Boolean(enrollmentResult.data) && isActiveCourseEnrollment({
    accessExpiresAt: enrollmentResult.data?.access_expires_at,
    accessSource: enrollmentResult.data?.access_source,
    activeAnnualPass,
    status: enrollmentResult.data?.statut
  });
  const isStaff = profileResult.data.role === "directeur" || profileResult.data.role === "formateur";
  const accessMode = isStaff ? "preview" : "learning";
  if (!hasPublishedCourseAccess({ activeAnnualPass, activeEnrollment, isStaff, published: true })) {
    return privateJson({ ok: false, error: "Ce cours n'est pas disponible sur votre compte." }, 403);
  }

  const modulesResult = await auth.supabase
    .from("course_modules")
    .select("id,course_id,titre,description,ordre,duree,type_contenu")
    .eq("course_id", courseResult.data.id)
    .order("ordre", { ascending: true });
  if (modulesResult.error) {
    return privateJson({ ok: false, error: "Le contenu du cours est momentanément indisponible." }, 500);
  }
  const modules = (modulesResult.data || []).map(module => ({
    course_id: module.course_id,
    description: module.description || "",
    duree: Number(module.duree || 0),
    id: module.id,
    ordre: Number(module.ordre || 0),
    titre: module.titre,
    type: module.type_contenu || "texte",
    type_contenu: module.type_contenu || "texte"
  }));
  const moduleIds = modules.map(module => module.id);
  const progressResult = moduleIds.length
    ? await auth.supabase
      .from("module_progress")
      .select("module_id,course_id,progression,complete,date_completion")
      .eq("etudiant_id", auth.user.id)
      .in("module_id", moduleIds)
    : { data: [], error: null };
  if (progressResult.error) {
    return privateJson({ ok: false, error: "La progression est momentanément indisponible." }, 500);
  }

  const publishedCoursesResult = await auth.supabase
    .from("courses")
    .select("slug,titre,semestre,numero")
    .eq("statut", "publie");
  const nextCourse = resolveNextPublishedCourse(
    publishedCoursesResult.error ? null : publishedCoursesResult.data,
    courseResult.data.slug
  );

  return privateJson({
    accessMode,
    nextCourse,
    course: {
      ...courseResult.data,
      competences: Array.isArray(courseResult.data.competences) ? courseResult.data.competences : [],
      description: courseResult.data.description || "",
      duree_totale: Number(courseResult.data.duree_totale_minutes || courseResult.data.duree_totale || courseResult.data.duree || 0),
      modules,
      nb_modules: modules.length,
      objectifs: Array.isArray(courseResult.data.objectifs) ? courseResult.data.objectifs : [],
      prerequis: Array.isArray(courseResult.data.prerequis) ? courseResult.data.prerequis : []
    },
    ok: true,
    profile: profileResult.data,
    progress: progressResult.data || []
  });
}
