import { courses as fallbackCourses, fallbackProfile, homework as fallbackHomework, profiles as fallbackProfiles } from "./data";
import { legalPages, type LegalPageKey } from "./legal";
import { createServerClient } from "./supabase";
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

function isLegacyBalzaacProfile(profile: Profile) {
  return [profile.prenom, profile.nom, profile.avatar_public_id, profile.avatar_url]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes("balzaac");
}

function normalizePublicTrainer(profile: Profile): Profile {
  if (!isLegacyBalzaacProfile(profile)) return profile;
  return {
    ...profile,
    email: "maspero@pusc.it",
    prenom: "Giulio",
    nom: "Maspero",
    profession: "Directeur d'études",
    bio: "Prêtre catholique, professeur ordinaire de théologie dogmatique à l'Université pontificale de la Sainte-Croix et doyen de sa Faculté de théologie depuis 2024.",
    bio_description: "Prêtre catholique, professeur ordinaire de théologie dogmatique à l'Université pontificale de la Sainte-Croix et doyen de sa Faculté de théologie depuis 2024. Il est notamment l'auteur de l'ouvrage Il mistero di Dio uno e trino.",
    specialites: ["Théologie dogmatique", "Mystère de Dieu", "Transmission de la foi"],
    realisations: [
      "Professeur ordinaire de théologie dogmatique",
      "Doyen de la Faculté de théologie de l'Université pontificale de la Sainte-Croix",
      "Auteur de Il mistero di Dio uno e trino",
      "Formation académique en physique théorique et en théologie"
    ],
    avatar_url: "/images/guillaume-maspero.jpg",
    avatar_public_id: undefined
  };
}

function cleanPublicCourseTitle(title: string) {
  return title.replace(/\s+et ses fractures\b/iu, "").trim();
}

function normalizeCourse(course: RawCourse, modules: CourseModule[] = []): Course {
  return {
    ...course,
    titre: cleanPublicCourseTitle(course.titre),
    auteur_nom: course.auteur_nom && isExcludedPublicName(course.auteur_nom) ? "Institut Saint Irénée" : course.auteur_nom,
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
  const supabase = createServerClient();
  if (!supabase) return fallbackProfiles;
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  return error || !data ? fallbackProfiles : data as Profile[];
}

export async function getCurrentProfile(): Promise<Profile> {
  const profiles = await getProfiles();
  return profiles.find(profile => profile.role === "directeur") || profiles[0] || fallbackProfile;
}

export async function getTrainers(): Promise<Profile[]> {
  const supabase = createServerClient();
  const { data, error } = supabase
    ? await supabase
      .from("profiles")
      .select("id,email,role,nom,prenom,profession,bio,bio_description,specialites,realisations,formation_academique,linkedin_url,twitter_url,instagram_url,tiktok_url,avatar_url,avatar_public_id,created_at,updated_at")
      .eq("role", "formateur")
      .order("created_at", { ascending: false })
    : { data: fallbackProfiles, error: null };
  const profiles = error || !data ? fallbackProfiles : data as Profile[];
  return profiles
    .filter(profile => profile.role === "formateur" && !isExcludedPublicName(`${profile.prenom} ${profile.nom}`))
    .map(normalizePublicTrainer);
}

export async function getCourses(
  scope: "public" | "admin" = "public",
  options: { authorId?: string } = {}
): Promise<Course[]> {
  const supabase = createServerClient();
  if (!supabase) {
    if (scope === "public") return fallbackCourses.filter(course => course.statut === "publie");
    return options.authorId ? fallbackCourses.filter(course => course.auteur_id === options.authorId) : fallbackCourses;
  }
  const baseQuery = supabase.from("courses").select("*").order("numero", { ascending: true });
  const { data, error } = scope === "public"
    ? await baseQuery.eq("statut", "publie")
    : options.authorId
      ? await baseQuery.eq("auteur_id", options.authorId)
      : await baseQuery;
  if (error || !data) {
    if (scope === "public") return fallbackCourses.filter(course => course.statut === "publie");
    return options.authorId ? fallbackCourses.filter(course => course.auteur_id === options.authorId) : fallbackCourses;
  }

  const courses = data as RawCourse[];
  if (scope === "public") return courses.map(course => normalizeCourse(course, []));
  const ids = courses.map(course => course.id);
  const { data: moduleRows, error: moduleError } = ids.length
    ? await supabase.from("course_modules").select("*").in("course_id", ids).order("ordre", { ascending: true })
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

  const fallback = (fallbackHomework as (Homework & { auteur_id?: string | null })[]).filter(item => {
    const matchesAuthor = options.authorId === undefined || item.auteur_id === options.authorId;
    const matchesCourse = options.courseIds === undefined || Boolean(item.course_id && options.courseIds.includes(item.course_id));
    return matchesAuthor && matchesCourse;
  });
  const supabase = createServerClient();
  if (!supabase) return fallback;
  const baseQuery = supabase.from("homework").select("*, homework_assignments(*)");
  let scopedQuery = options.authorId === undefined
    ? baseQuery
    : baseQuery.eq("auteur_id", options.authorId);
  if (options.courseIds) scopedQuery = scopedQuery.in("course_id", options.courseIds);
  const { data, error } = await scopedQuery.order("created_at", { ascending: false });
  return error || !data ? fallback : data as Homework[];
}

export async function getPaymentRequests(): Promise<Profile[]> {
  const profiles = await getProfiles();
  return profiles.filter(profile => {
    const hasRegistration = Boolean(profile.formation_choisie || profile.tarif_applicable || profile.modalite_paiement || profile.moyen_paiement);
    return hasRegistration || profile.statut_inscription === "en_attente";
  });
}

export async function getBookRequests(): Promise<BookRequest[]> {
  const supabase = createServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("book_requests")
    .select("*, profiles(prenom, nom, email), courses(titre, slug)")
    .order("requested_at", { ascending: false });
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
  const supabase = createServerClient();
  const fallback = legalPages[slug];
  if (!supabase) return fallback;
  const { data, error } = await supabase.from("legal_pages").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return fallback;
  return {
    title: data.titre || fallback.title,
    intro: fallback.intro,
    content: data.contenu || fallback.content
  };
}

export function formatDbAvatar(profile: Profile) {
  const src = profile.avatar_public_id || profile.avatar_url;
  if (!src) return profile.role === "formateur" ? "/images/guillaume-maspero.jpg" : undefined;
  if (src.startsWith("http") || src.startsWith("/")) return src;
  if (src.includes("balzaac")) return "/images/guillaume-maspero.jpg";
  if (src.includes("nezchristos")) return "/images/nezchristos.jpeg";
  return cloudinaryAvatarUrl(src);
}
