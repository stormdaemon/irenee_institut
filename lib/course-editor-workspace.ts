const RECOVERY_VERSION = 2;
const RECOVERY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const RECOVERY_MAX_BYTES = 2_000_000;

type DraftModule = {
  clientId?: string;
  contenu_html?: string;
  description?: string;
  duree?: number;
  ordre?: number;
  quiz?: unknown;
  titre?: string;
  type_contenu?: string;
  url_video?: string;
  [key: string]: unknown;
};

export type RecoverableCourseDraft = {
  competences: string[];
  description: string;
  duree_totale_minutes: number;
  modules: DraftModule[];
  niveau: string;
  objectifs: string[];
  prerequis: string[];
  prix: string;
  prix_reduit: string;
  slug: string;
  statut: string;
  titre: string;
  [key: string]: unknown;
};

export type CourseEditorSection = "overview" | "pedagogy" | "modules" | "publication";

export type CourseReadinessItem = {
  complete: boolean;
  id: "identity" | "pedagogy" | "modules" | "content" | "publication";
  label: string;
  section: CourseEditorSection;
};

export type CourseDraftRecovery<T extends RecoverableCourseDraft> = {
  draft: T;
  savedSignature: string;
  serverConflict?: boolean;
  storedAt: number;
  version: typeof RECOVERY_VERSION;
  workspace?: {
    activeModuleClientId?: string | null;
    activeSection?: CourseEditorSection;
  };
};

function cleanStrings(values: unknown) {
  return Array.isArray(values) ? values.map(String).map(value => value.trim()).filter(Boolean) : [];
}

function stableDraftSignature(draft: RecoverableCourseDraft) {
  return JSON.stringify({
    ...draft,
    competences: [...draft.competences],
    objectifs: [...draft.objectifs],
    prerequis: [...draft.prerequis],
    modules: draft.modules.map((module, index) => {
      const { clientId: _clientId, ...authoredModule } = module;
      return { ...authoredModule, ordre: index + 1 };
    }),
  });
}

function isRecoverableDraft(value: unknown): value is RecoverableCourseDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return ["titre", "slug", "description", "niveau", "statut", "prix", "prix_reduit"]
    .every(key => typeof draft[key] === "string")
    && typeof draft.duree_totale_minutes === "number"
    && [draft.objectifs, draft.competences, draft.prerequis].every(list => (
      Array.isArray(list)
      && list.length <= 500
      && list.every(item => typeof item === "string" && item.length <= 10_000)
    ))
    && Array.isArray(draft.modules)
    && draft.modules.length <= 500
    && draft.modules.every(module => {
      if (!module || typeof module !== "object" || Array.isArray(module)) return false;
      const item = module as Record<string, unknown>;
      const textFields = ["clientId", "titre", "description", "contenu_html", "url_video", "type_contenu"];
      if (!textFields.every(key => item[key] === undefined || (typeof item[key] === "string" && String(item[key]).length <= 1_000_000))) return false;
      if (item.duree !== undefined && (!Number.isFinite(item.duree) || Number(item.duree) < 0)) return false;
      if (item.ordre !== undefined && (!Number.isInteger(item.ordre) || Number(item.ordre) < 0)) return false;
      if (item.quiz === undefined) return true;
      if (!Array.isArray(item.quiz) || item.quiz.length > 100) return false;
      return item.quiz.every(question => {
        if (!question || typeof question !== "object" || Array.isArray(question)) return false;
        const entry = question as Record<string, unknown>;
        return typeof entry.id === "string"
          && /^[a-zA-Z0-9_-]{1,100}$/.test(entry.id)
          && typeof entry.question === "string"
          && entry.question.length <= 10_000
          && Array.isArray(entry.options)
          && entry.options.length <= 20
          && entry.options.every(option => typeof option === "string" && option.length <= 10_000)
          && Number.isInteger(entry.answer);
      });
    });
}

function hasReadyQuiz(value: unknown) {
  return Array.isArray(value) && value.length > 0 && value.every(question => {
    if (!question || typeof question !== "object" || Array.isArray(question)) return false;
    const entry = question as Record<string, unknown>;
    const options = Array.isArray(entry.options) ? entry.options.map(String) : [];
    const normalizedOptions = options.map(option => option.trim().toLocaleLowerCase("fr"));
    return String(entry.question || "").trim().length > 0
      && options.length >= 2
      && options.every(option => option.trim().length > 0)
      && new Set(normalizedOptions).size === normalizedOptions.length
      && Number.isInteger(entry.answer)
      && Number(entry.answer) >= 0
      && Number(entry.answer) < options.length;
  });
}

export function getCourseEditorReadiness(draft: RecoverableCourseDraft) {
  const modules = Array.isArray(draft.modules) ? draft.modules : [];
  const hasPedagogy = cleanStrings(draft.objectifs).length > 0 && cleanStrings(draft.competences).length > 0;
  const validPrice = [draft.prix, draft.prix_reduit].every(value => {
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0;
  });
  const items: CourseReadinessItem[] = [
    {
      complete: Boolean(draft.titre.trim() && draft.slug.trim() && draft.description.trim()),
      id: "identity",
      label: "Titre, adresse et présentation",
      section: "overview",
    },
    {
      complete: hasPedagogy,
      id: "pedagogy",
      label: "Objectifs et compétences",
      section: "pedagogy",
    },
    {
      complete: modules.length > 0 && modules.every(module => String(module.titre || "").trim()),
      id: "modules",
      label: "Programme structuré",
      section: "modules",
    },
    {
      complete: modules.length > 0 && modules.every(module => {
        const type = String(module.type_contenu || "texte");
        const hasText = String(module.contenu_html || "").replace(/<[^>]*>/g, " ").trim().length > 0;
        const hasVideo = /^https:\/\//i.test(String(module.url_video || "").trim());
        const hasContent = type === "quiz"
          ? hasReadyQuiz(module.quiz)
          : type === "video"
            ? hasText || hasVideo
            : hasText;
        return Boolean(String(module.titre || "").trim() && hasContent);
      }),
      id: "content",
      label: "Contenu de chaque module",
      section: "modules",
    },
    {
      complete: Boolean(draft.niveau && draft.statut && Number.isFinite(Number(draft.duree_totale_minutes)) && draft.duree_totale_minutes >= 0 && validPrice),
      id: "publication",
      label: "Paramètres de diffusion valides",
      section: "publication",
    },
  ];
  return {
    completed: items.filter(item => item.complete).length,
    items,
    total: items.length,
  };
}

export function getCourseEditorSectionStatus(draft: RecoverableCourseDraft, section: CourseEditorSection) {
  const readiness = getCourseEditorReadiness(draft);
  const items = readiness.items.filter(item => item.section === section);
  return items.length > 0 && items.every(item => item.complete);
}

function recoveryKeyPart(value: string | undefined, fallback: string) {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100) || fallback;
}

export function courseDraftRecoveryPrefix(courseId: string | undefined, userId: string) {
  const user = recoveryKeyPart(userId, "unknown-user");
  const course = recoveryKeyPart(courseId, "new");
  return `irenee:course-draft:v${RECOVERY_VERSION}:${user}:${course}:`;
}

export function courseDraftRecoveryKey(courseId: string | undefined, userId: string, tabId: string) {
  return `${courseDraftRecoveryPrefix(courseId, userId)}${recoveryKeyPart(tabId, "unknown-tab")}`;
}

export function createCourseDraftRecovery<T extends RecoverableCourseDraft>(
  draft: T,
  savedDraft: T,
  now = Date.now(),
  workspace?: CourseDraftRecovery<T>["workspace"],
): CourseDraftRecovery<T> {
  return {
    draft,
    savedSignature: stableDraftSignature(savedDraft),
    storedAt: now,
    version: RECOVERY_VERSION,
    ...(workspace ? { workspace } : {}),
  };
}

export function parseCourseDraftRecovery<T extends RecoverableCourseDraft>(raw: string | null, serverDraft: T, now = Date.now()): CourseDraftRecovery<T> | null {
  if (!raw || raw.length > RECOVERY_MAX_BYTES) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CourseDraftRecovery<T>>;
    if (parsed.version !== RECOVERY_VERSION || !Number.isFinite(parsed.storedAt)) return null;
    const age = now - Number(parsed.storedAt);
    if (age < -5 * 60 * 1_000 || age > RECOVERY_MAX_AGE_MS) return null;
    if (typeof parsed.savedSignature !== "string" || !isRecoverableDraft(parsed.draft)) return null;
    if (stableDraftSignature(parsed.draft) === stableDraftSignature(serverDraft)) return null;
    const serverConflict = parsed.savedSignature !== stableDraftSignature(serverDraft);
    const rawWorkspace = parsed.workspace && typeof parsed.workspace === "object" ? parsed.workspace : null;
    const allowedSections: CourseEditorSection[] = ["overview", "pedagogy", "modules", "publication"];
    const activeSection = rawWorkspace && allowedSections.includes(rawWorkspace.activeSection as CourseEditorSection)
      ? rawWorkspace.activeSection as CourseEditorSection
      : undefined;
    const activeModuleClientId = rawWorkspace && typeof rawWorkspace.activeModuleClientId === "string"
      ? rawWorkspace.activeModuleClientId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 160) || null
      : null;
    return {
      draft: parsed.draft as T,
      savedSignature: parsed.savedSignature,
      ...(serverConflict ? { serverConflict: true } : {}),
      storedAt: Number(parsed.storedAt),
      version: RECOVERY_VERSION,
      ...(activeSection || activeModuleClientId ? { workspace: { activeModuleClientId, activeSection } } : {}),
    };
  } catch {
    return null;
  }
}
