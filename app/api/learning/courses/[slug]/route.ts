import { pgRead } from "@/lib/postgres";
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
    pgRead("select t.\"id\", t.\"email\", t.\"prenom\", t.\"nom\", t.\"role\" from public.\"profiles\" t where t.\"id\" = $1", [auth.user.id], "optional"),
    pgRead("select t.\"id\", t.\"titre\", t.\"slug\", t.\"description\", t.\"image_url\", t.\"objectifs\", t.\"competences\", t.\"prerequis\", t.\"semestre\", t.\"numero\", t.\"duree\", t.\"niveau\", t.\"statut\", t.\"nb_modules\", t.\"duree_totale_minutes\", t.\"duree_totale\", t.\"prix\", t.\"prix_reduit\" from public.\"courses\" t where t.\"slug\" = $1 and t.\"statut\" = $2", [slug, "publie"], "optional"),
    pgRead("select t.\"id\", t.\"expires_at\" from public.\"annual_access_passes\" t where t.\"user_id\" = $1 and t.\"status\" = $2 and t.\"expires_at\" > $3 order by t.\"expires_at\" desc limit $4", [auth.user.id, "active", now, 1], "optional")
  ]);
  if (profileResult.error || courseResult.error || annualPassResult.error) {
    return privateJson({ ok: false, error: "Impossible de vérifier l'accès au cours." }, 500);
  }
  if (!profileResult.data || !courseResult.data) {
    return privateJson({ ok: false, error: "Cours introuvable." }, 404);
  }

  const enrollmentResult = await pgRead("select t.\"id\", t.\"statut\", t.\"access_source\", t.\"access_expires_at\" from public.\"course_enrollments\" t where t.\"etudiant_id\" = $1 and t.\"course_id\" = $2 and t.\"statut\" = $3", [auth.user.id, courseResult.data.id, "en_cours"], "optional");
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

  const modulesResult = await pgRead("select t.\"id\", t.\"course_id\", t.\"titre\", t.\"description\", t.\"ordre\", t.\"duree\", t.\"type_contenu\" from public.\"course_modules\" t where t.\"course_id\" = $1 order by t.\"ordre\" asc", [courseResult.data.id], "many");
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
    ? await pgRead("select t.\"module_id\", t.\"course_id\", t.\"progression\", t.\"complete\", t.\"date_completion\" from public.\"module_progress\" t where t.\"etudiant_id\" = $1 and t.\"module_id\" = any($2)", [auth.user.id, moduleIds], "many")
    : { data: [], error: null };
  if (progressResult.error) {
    return privateJson({ ok: false, error: "La progression est momentanément indisponible." }, 500);
  }

  const publishedCoursesResult = await pgRead<{slug:string;titre:string;semestre:number;numero:number}>("select t.\"slug\", t.\"titre\", t.\"semestre\", t.\"numero\" from public.\"courses\" t where t.\"statut\" = $1", ["publie"], "many");
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
