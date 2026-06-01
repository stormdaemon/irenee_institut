import { courses as fallbackCourses, fallbackProfile, homework as fallbackHomework, profiles as fallbackProfiles } from "./data";
import { legalPages, type LegalPageKey } from "./legal";
import { createServerClient } from "./supabase";
import { cloudinaryAvatarUrl } from "./cloudinary";
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
  duree?: number | null;
  ressources?: unknown;
  type_contenu?: string | null;
  quiz?: CourseModule["quiz"] | null;
};

function isExcludedPublicName(name: string) {
  const normalizedName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalizedName.includes("raffray") || normalizedName.includes("rafray");
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
    prenom: "Guillaume",
    nom: "Maspero",
    profession: "Professeur de théologie dogmatique",
    bio: "Prêtre catholique et professeur de théologie dogmatique.",
    bio_description: "Prêtre catholique et professeur de théologie dogmatique.",
    specialites: ["Théologie dogmatique", "Mystère de Dieu", "Transmission de la foi"],
    realisations: [
      "Professeur ordinaire de théologie dogmatique",
      "Doyen de la Faculté de théologie",
      "Formation académique en physique théorique et en théologie"
    ],
    avatar_url: "/images/guillaume-maspero.jpg",
    avatar_public_id: undefined
  };
}

function normalizeCourse(course: RawCourse, modules: CourseModule[] = []): Course {
  return {
    ...course,
    auteur_nom: course.auteur_nom && isExcludedPublicName(course.auteur_nom) ? "Institut Irénée" : course.auteur_nom,
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
    ordre: module.ordre ?? 0,
    duree: Number(module.duree || 0),
    type: module.type_contenu || "texte",
    type_contenu: module.type_contenu,
    contenu: module.contenu,
    contenu_html: module.contenu_html || module.contenu || "",
    url_video: module.url_video,
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
  const profiles = await getProfiles();
  return profiles
    .filter(profile => profile.role === "formateur" && !isExcludedPublicName(`${profile.prenom} ${profile.nom}`))
    .map(normalizePublicTrainer);
}

export async function getCourses(): Promise<Course[]> {
  const supabase = createServerClient();
  if (!supabase) return fallbackCourses;
  const { data, error } = await supabase.from("courses").select("*").order("numero", { ascending: true });
  if (error || !data) return fallbackCourses;

  const courses = data as RawCourse[];
  const ids = courses.map(course => course.id);
  const { data: moduleRows } = ids.length
    ? await supabase.from("course_modules").select("*").in("course_id", ids).order("ordre", { ascending: true })
    : { data: [] };

  const modulesByCourse = new Map<string, CourseModule[]>();
  for (const row of (moduleRows || []) as RawModule[]) {
    const list = modulesByCourse.get(row.course_id) || [];
    list.push(normalizeModule(row));
    modulesByCourse.set(row.course_id, list);
  }

  return courses.map(course => normalizeCourse(course, modulesByCourse.get(course.id) || []));
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const courses = await getCourses();
  return courses.find(course => course.slug === slug)
    || courses.find(course => slug === "introduction-generale-apologetique-chretienne" && course.slug === "introduction-apologetique-chretienne")
    || null;
}

export async function getHomework(): Promise<Homework[]> {
  const supabase = createServerClient();
  if (!supabase) return fallbackHomework as Homework[];
  const { data, error } = await supabase.from("homework").select("*, homework_assignments(*)").order("created_at", { ascending: false });
  return error || !data ? fallbackHomework as Homework[] : data as Homework[];
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
  const [courses, profiles, paymentRequests] = await Promise.all([getCourses(), getProfiles(), getPaymentRequests()]);
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
