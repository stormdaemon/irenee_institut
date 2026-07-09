import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { projectPublicQuiz } from "@/lib/learning-projection";
import { hasPublishedCourseAccess, isActiveCourseEnrollment } from "@/lib/learning-security";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { slug } = await params;
  if (!slugPattern.test(slug)) {
    return NextResponse.json({ ok: false, error: "Cours introuvable." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const [profileResult, courseResult, annualPassResult] = await Promise.all([
    auth.supabase.from("profiles").select("id,email,prenom,nom,role").eq("id", auth.user.id).maybeSingle(),
    auth.supabase.from("courses").select("*").eq("slug", slug).eq("statut", "publie").maybeSingle(),
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
    return NextResponse.json({ ok: false, error: "Impossible de vérifier l'accès au cours." }, { status: 500 });
  }
  if (!profileResult.data || !courseResult.data) {
    return NextResponse.json({ ok: false, error: "Cours introuvable." }, { status: 404 });
  }

  const enrollmentResult = await auth.supabase
    .from("course_enrollments")
    .select("id,statut,access_source,access_expires_at")
    .eq("etudiant_id", auth.user.id)
    .eq("course_id", courseResult.data.id)
    .eq("statut", "en_cours")
    .maybeSingle();
  if (enrollmentResult.error) {
    return NextResponse.json({ ok: false, error: "Impossible de vérifier l'accès au cours." }, { status: 500 });
  }

  const activeAnnualPass = Boolean(annualPassResult.data);
  const activeEnrollment = Boolean(enrollmentResult.data) && isActiveCourseEnrollment({
    accessExpiresAt: enrollmentResult.data?.access_expires_at,
    accessSource: enrollmentResult.data?.access_source,
    activeAnnualPass,
    status: enrollmentResult.data?.statut
  });
  const isStaff = profileResult.data.role === "directeur" || profileResult.data.role === "formateur";
  if (!hasPublishedCourseAccess({ activeAnnualPass, activeEnrollment, isStaff, published: true })) {
    return NextResponse.json({ ok: false, error: "Ce cours n'est pas disponible sur votre compte." }, { status: 403 });
  }

  const modulesResult = await auth.supabase
    .from("course_modules")
    .select("*")
    .eq("course_id", courseResult.data.id)
    .order("ordre", { ascending: true });
  if (modulesResult.error) {
    return NextResponse.json({ ok: false, error: "Le contenu du cours est momentanément indisponible." }, { status: 500 });
  }
  const modules = (modulesResult.data || []).map(module => ({
    ...module,
    contenu_html: module.contenu_html || module.contenu || "",
    description: module.description || "",
    duree: Number(module.duree || 0),
    quiz: projectPublicQuiz(module.quiz),
    type: module.type_contenu || "texte"
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
    return NextResponse.json({ ok: false, error: "La progression est momentanément indisponible." }, { status: 500 });
  }

  return NextResponse.json({
    course: {
      ...courseResult.data,
      competences: Array.isArray(courseResult.data.competences) ? courseResult.data.competences : [],
      description: courseResult.data.description || "",
      duree_totale: Number(courseResult.data.duree_totale_minutes || courseResult.data.duree_totale || 0),
      modules,
      nb_modules: modules.length,
      objectifs: Array.isArray(courseResult.data.objectifs) ? courseResult.data.objectifs : [],
      prerequis: Array.isArray(courseResult.data.prerequis) ? courseResult.data.prerequis : []
    },
    ok: true,
    profile: profileResult.data,
    progress: progressResult.data || []
  }, { headers: { "Cache-Control": "private, no-store" } });
}
