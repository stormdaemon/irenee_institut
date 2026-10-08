import { pgRead } from "@/lib/postgres";
import { legalPages, type LegalPageKey } from "./legal";
import { createServerContext } from "./postgres";
import { cloudinaryAvatarUrl } from "./cloudinary";
import { query } from "./db";
import type { BookRequest, Course, CourseModule, Homework, Profile } from "./types";

type RawCourse = Omit<Course, "modules" | "objectifs" | "competences" | "prerequis"> & {
  objectifs?: string[] | null;
  competences?: string[] | null;
  prerequis?: string[] | null;
  duree?: number | null;
};

type RawModule = {
  id: string;
  course_id: string;
  titre: string;
  description?: string | null;
  ordre?: number | null;
  contenu?: string | null;
  contenu_html?: string | null;
  url_video?: string | null;
  url_sous_titres?: string | null;
  duree?: number | null;
  ressources?: unknown;
  type_contenu?: string | null;
  quiz?: CourseModule["quiz"] | null;
};

function isExcludedPublicName(name: string) {
  const normalizedName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalizedName.includes("raffray") || normalizedName.includes("rafray") || normalizedName.includes("nezchristos") || normalizedName.includes("tanouarn");
}

function cleanPublicCourseTitle(title: string) {
  return title.replace(/\s+et ses fractures\b/iu, "").trim();
}

function normalizeCourse(course: RawCourse, modules: CourseModule[] = []): Course {
  return {
    ...course,
    titre: cleanPublicCourseTitle(course.titre),
    auteur_nom: course.auteur_nom && isExcludedPublicName(course.auteur_nom) ? "Institut Apostolos Saint Irénée" : course.auteur_nom,
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
    titre: cleanPublicCourseTitle(module.titre),
    description: module.description || "",
    ordre: module.ordre ?? 0,
    duree: Number(module.duree || 0),
    type: module.type_contenu || "texte",
    type_contenu: module.type_contenu,
    contenu: module.contenu,
    contenu_html: module.contenu_html || module.contenu || "",
    url_video: module.url_video,
    url_sous_titres: module.url_sous_titres,
    ressources: module.ressources,
    quiz: module.quiz || undefined
  };
}

export async function getProfiles(): Promise<Profile[]> {
  const context = createServerContext();
  if (!context) throw new Error("La base de données est indisponible.");
  const { data, error } = await pgRead("select t.* from public.\"profiles\" t order by t.\"created_at\" desc", [], "many");
  if (error) throw new Error("Les profils ne peuvent pas être chargés.");
  return (data || []) as Profile[];
}

export async function getTrainers(): Promise<Profile[]> {
  const context = createServerContext();
  if (!context) throw new Error("La base de données est indisponible.");
  const { data, error } = await pgRead("select t.\"id\", t.\"email\", t.\"role\", t.\"nom\", t.\"prenom\", t.\"profession\", t.\"bio\", t.\"bio_description\", t.\"specialites\", t.\"realisations\", t.\"formation_academique\", t.\"linkedin_url\", t.\"twitter_url\", t.\"instagram_url\", t.\"tiktok_url\", t.\"avatar_url\", t.\"avatar_public_id\", t.\"created_at\", t.\"updated_at\" from public.\"profiles\" t where t.\"role\" = $1 order by t.\"created_at\" desc", ["formateur"], "many");

  if (error) throw new Error("Les formateurs ne peuvent pas être chargés.");
  const profiles = (data || []) as Profile[];
  return profiles
    .filter(profile => profile.role === "formateur" && !isExcludedPublicName(`${profile.prenom} ${profile.nom}`));
}

export async function getCourses(
  scope: "public" | "admin" = "public",
  options: { authorId?: string } = {}
): Promise<Course[]> {
  const context = createServerContext();
  if (!context) throw new Error("La base de données est indisponible.");
  const { data, error } = await pgRead<RawCourse>(
    `select * from public.courses where ($1::boolean or statut='publie')
     and ($2::uuid is null or auteur_id=$2) order by numero asc`,
    [scope === "admin", scope === "admin" ? options.authorId || null : null]);
  if (error) throw new Error("Les cours ne peuvent pas être chargés.");

  const courses = (data || []) as RawCourse[];
  if (scope === "public") return courses.map(course => normalizeCourse(course, []));
  const ids = courses.map(course => course.id);
  const { data: moduleRows, error: moduleError } = ids.length
    ? await pgRead("select t.* from public.\"course_modules\" t where t.\"course_id\" = any($1) order by t.\"ordre\" asc", [ids], "many")
    : { data: [], error: null };
  if (moduleError) {
    throw new Error("Les modules des cours n'ont pas pu être chargés sans risque.");
  }

  const modulesByCourse = new Map<string, CourseModule[]>();
  for (const row of (moduleRows || []) as RawModule[]) {
    const list = modulesByCourse.get(row.course_id) || [];
    list.push(normalizeModule(row));
    modulesByCourse.set(row.course_id, list);
  }

  const updateTokenRows = ids.length
    ? await query<{ id: string; updated_at_token: string }>(
      `select id,
              to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at_token
       from public.courses
       where id = any($1::uuid[])`,
      [ids]
    )
    : { rows: [] as { id: string; updated_at_token: string }[] };
  const updateTokens = new Map(updateTokenRows.rows.map(row => [row.id, row.updated_at_token]));

  return courses.map(course => normalizeCourse({
    ...course,
    updated_at: updateTokens.get(course.id) || course.updated_at,
  }, modulesByCourse.get(course.id) || []));
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const courses = await getCourses();
  return courses.find(course => course.slug === slug)
    || courses.find(course => slug === "introduction-generale-apologetique-chretienne" && course.slug === "introduction-apologetique-chretienne")
    || null;
}

export async function getHomework(options: { authorId?: string; courseIds?: string[] } = {}): Promise<Homework[]> {
  if (options.courseIds && options.courseIds.length === 0) return [];

  const context = createServerContext();
  if (!context) throw new Error("La base de données est indisponible.");
  const { data, error } = await pgRead(`select t.*,
    coalesce((select jsonb_agg(r) from public.homework_assignments r where r.homework_id=t.id), '[]'::jsonb) as homework_assignments
    from public.homework t where ($1::uuid is null or t.auteur_id=$1)
    and ($2::uuid[] is null or t.course_id=any($2)) order by t.created_at desc`,
    [options.authorId || null, options.courseIds || null]);
  if (error) throw new Error("Les devoirs ne peuvent pas être chargés.");
  return (data || []) as Homework[];
}

export async function getPaymentRequests(): Promise<Profile[]> {
  const profiles = await getProfiles();
  return profiles.filter(profile => {
    if (profile.role !== "etudiant") return false;
    const hasRegistration = Boolean(profile.formation_choisie || profile.tarif_applicable || profile.modalite_paiement || profile.moyen_paiement);
    return hasRegistration || profile.statut_inscription === "en_attente";
  });
}

export async function getBookRequests(): Promise<BookRequest[]> {
  const context = createServerContext();
  if (!context) return [];
  const { data, error } = await pgRead("select t.*, (select to_jsonb(nested) from (select r.\"prenom\", r.\"nom\", r.\"email\" from public.\"profiles\" r where r.\"id\" = t.\"user_id\" limit 1) nested) as \"profiles\", (select to_jsonb(nested) from (select r.\"titre\", r.\"slug\" from public.\"courses\" r where r.\"id\" = t.\"course_id\" limit 1) nested) as \"courses\" from public.\"book_requests\" t order by t.\"requested_at\" desc", [], "many");
  return error || !data ? [] : data as BookRequest[];
}

export async function getStats() {
  const [courses, profiles, paymentRequests] = await Promise.all([getCourses("admin"), getProfiles(), getPaymentRequests()]);
  return {
    cours: courses.length,
    etudiants: profiles.filter(profile => profile.role === "etudiant").length,
    inscriptions: paymentRequests.length
  };
}

export async function getLegalPage(slug: LegalPageKey) {
  const context = createServerContext();
  const fallback = legalPages[slug];
  if (!context) return fallback;
  const { data, error } = await pgRead("select * from public.legal_pages where slug=$1", [slug], "optional");
  if (error || !data) return fallback;
  return {
    title: data.titre || fallback.title,
    intro: fallback.intro,
    content: data.contenu || fallback.content
  };
}

export function formatDbAvatar(profile: Profile) {
  const src = profile.avatar_public_id || profile.avatar_url;
  if (!src) return undefined;
  if (src.startsWith("http") || src.startsWith("/")) return src;
  return cloudinaryAvatarUrl(src);
}
