import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { projectPublicQuiz } from "@/lib/learning-projection";
import { hasPublishedCourseAccess, isActiveCourseEnrollment } from "@/lib/learning-security";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const privateNoStoreHeaders = { "Cache-Control": "private, no-store" };

function privateJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { headers: privateNoStoreHeaders, status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; moduleId: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { slug, moduleId } = await params;
  if (!slugPattern.test(slug) || !uuidPattern.test(moduleId)) {
    return privateJson({ ok: false, error: "Module introuvable." }, 404);
  }

  const now = new Date().toISOString();
  const [profileResult, courseResult, annualPassResult] = await Promise.all([
    auth.supabase
      .from("profiles")
      .select("id,email,prenom,nom,role")
      .eq("id", auth.user.id)
      .maybeSingle(),
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
    return privateJson({ ok: false, error: "Impossible de vérifier l'accès au module." }, 500);
  }
  if (!profileResult.data || !courseResult.data) {
    return privateJson({ ok: false, error: "Module introuvable." }, 404);
  }

  const enrollmentResult = await auth.supabase
    .from("course_enrollments")
    .select("id,statut,access_source,access_expires_at")
    .eq("etudiant_id", auth.user.id)
    .eq("course_id", courseResult.data.id)
    .eq("statut", "en_cours")
    .maybeSingle();
  if (enrollmentResult.error) {
    return privateJson({ ok: false, error: "Impossible de vérifier l'accès au module." }, 500);
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

  const outlineResult = await auth.supabase
    .from("course_modules")
    .select("id,course_id,titre,description,ordre,duree,type_contenu")
    .eq("course_id", courseResult.data.id)
    .order("ordre", { ascending: true });
  if (outlineResult.error) {
    return privateJson({ ok: false, error: "Le plan du cours est momentanément indisponible." }, 500);
  }

  const outline = (outlineResult.data || []).map(module => ({
    course_id: module.course_id,
    description: module.description || "",
    duree: Number(module.duree || 0),
    id: module.id,
    ordre: Number(module.ordre || 0),
    titre: module.titre,
    type: module.type_contenu || "texte",
    type_contenu: module.type_contenu || "texte"
  }));
  const currentIndex = outline.findIndex(module => module.id === moduleId);
  if (currentIndex < 0) {
    return privateJson({ ok: false, error: "Module introuvable." }, 404);
  }

  const moduleIds = outline.map(module => module.id);
  const progressResult = await auth.supabase
    .from("module_progress")
    .select("module_id,course_id,progression,complete,date_debut,date_completion,statut")
    .eq("etudiant_id", auth.user.id)
    .in("module_id", moduleIds);
  if (progressResult.error) {
    return privateJson({ ok: false, error: "La progression est momentanément indisponible." }, 500);
  }

  const progress = progressResult.data || [];
  const completedModuleIds = new Set(
    progress.filter(item => item.complete === true).map(item => String(item.module_id))
  );
  const firstIncompleteModule = outline.find(module => !completedModuleIds.has(module.id));
  const missingPreviousModule = outline
    .slice(0, currentIndex)
    .find(module => !completedModuleIds.has(module.id));
  if (!isStaff && missingPreviousModule) {
    return privateJson({
      error: "Terminez les modules précédents dans l'ordre du cours.",
      ok: false,
      resumeModuleId: firstIncompleteModule?.id || missingPreviousModule.id
    }, 409);
  }

  const moduleResult = await auth.supabase
    .from("course_modules")
    .select("id,course_id,titre,description,ordre,contenu,contenu_html,url_video,url_sous_titres,duree,ressources,type_contenu,quiz")
    .eq("course_id", courseResult.data.id)
    .eq("id", moduleId)
    .maybeSingle();
  if (moduleResult.error) {
    return privateJson({ ok: false, error: "Le contenu du module est momentanément indisponible." }, 500);
  }
  if (!moduleResult.data) {
    return privateJson({ ok: false, error: "Module introuvable." }, 404);
  }

  const module = {
    contenu: moduleResult.data.contenu || "",
    contenu_html: moduleResult.data.contenu_html || moduleResult.data.contenu || "",
    course_id: moduleResult.data.course_id,
    description: moduleResult.data.description || "",
    duree: Number(moduleResult.data.duree || 0),
    id: moduleResult.data.id,
    ordre: Number(moduleResult.data.ordre || 0),
    quiz: projectPublicQuiz(moduleResult.data.quiz),
    ressources: Array.isArray(moduleResult.data.ressources) ? moduleResult.data.ressources : [],
    titre: moduleResult.data.titre,
    type: moduleResult.data.type_contenu || "texte",
    type_contenu: moduleResult.data.type_contenu || "texte",
    url_video: moduleResult.data.url_video || "",
    url_sous_titres: moduleResult.data.url_sous_titres || ""
  };

  return privateJson({
    accessMode,
    course: {
      ...courseResult.data,
      competences: Array.isArray(courseResult.data.competences) ? courseResult.data.competences : [],
      description: courseResult.data.description || "",
      duree_totale: Number(courseResult.data.duree_totale_minutes || courseResult.data.duree_totale || courseResult.data.duree || 0),
      modules: outline,
      nb_modules: outline.length,
      objectifs: Array.isArray(courseResult.data.objectifs) ? courseResult.data.objectifs : [],
      prerequis: Array.isArray(courseResult.data.prerequis) ? courseResult.data.prerequis : []
    },
    module,
    ok: true,
    profile: profileResult.data,
    progress
  });
}
