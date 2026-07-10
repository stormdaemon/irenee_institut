"use client";

import type { Course, CourseModule } from "@/lib/types";
import DOMPurify from "dompurify";
import { Check, Eye, FileText, GripVertical, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";
import { RichHtmlEditor } from "@/components/RichHtmlEditor";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import {
  courseDraftRecoveryKey,
  courseDraftRecoveryPrefix,
  createCourseDraftRecovery,
  getCourseEditorReadiness,
  getCourseEditorSectionStatus,
  parseCourseDraftRecovery,
  type CourseEditorSection,
} from "@/lib/course-editor-workspace";

export type QuizQuestionDraft = {
  id: string;
  question: string;
  options: string[];
  answer: number;
};

export type ModuleDraft = {
  id?: string;
  clientId: string;
  titre: string;
  description: string;
  contenu_html: string;
  url_video: string;
  duree: number;
  type_contenu: string;
  ordre: number;
  quiz?: QuizQuestionDraft[];
};

export type CourseDraft = {
  id?: string;
  titre: string;
  slug: string;
  description: string;
  image_url: string;
  niveau: string;
  statut: string;
  semestre: number;
  numero: number;
  prix: string;
  prix_reduit: string;
  duree_totale_minutes: number;
  url_paiement_paypal: string;
  objectifs: string[];
  competences: string[];
  prerequis: string[];
  modules: ModuleDraft[];
  updated_at?: string;
};

const editorSections: { id: CourseEditorSection; label: string; description: string }[] = [
  { id: "overview", label: "Vue d’ensemble", description: "Aperçu" },
  { id: "pedagogy", label: "Pédagogie", description: "Objectifs" },
  { id: "modules", label: "Programme", description: "Modules" },
  { id: "publication", label: "Publication", description: "Diffusion" },
];

const emptyModule = (ordre = 1, clientId = `local-module-${ordre}`): ModuleDraft => ({
  clientId,
  titre: "",
  description: "",
  contenu_html: "",
  url_video: "",
  duree: 150,
  type_contenu: "texte",
  ordre,
  quiz: [],
});

const emptyDraft = (): CourseDraft => ({
  titre: "",
  slug: "",
  description: "",
  image_url: "",
  niveau: "debutant",
  statut: "brouillon",
  semestre: 1,
  numero: 0,
  prix: "99",
  prix_reduit: "99",
  duree_totale_minutes: 750,
  url_paiement_paypal: "",
  objectifs: [""],
  competences: [""],
  prerequis: [""],
  modules: [],
  updated_at: "",
});

function eurosFromCents(value?: number | null) {
  return String(Number(value || 0) / 100).replace(".", ",");
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function moduleFromDb(module: CourseModule, index: number): ModuleDraft {
  return {
    id: module.id,
    clientId: `saved-module-${module.id}`,
    titre: module.titre || "",
    description: module.description || "",
    contenu_html: module.contenu_html || module.contenu || "",
    url_video: module.url_video || "",
    duree: Number(module.duree || 0),
    type_contenu: module.type_contenu || module.type || "texte",
    ordre: module.ordre ?? index + 1,
    quiz: Array.isArray(module.quiz) ? module.quiz.map((question, questionIndex) => ({
      id: String(question.id || `question-${index + 1}-${questionIndex + 1}`).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100),
      question: String(question.question || ""),
      options: Array.isArray(question.options) ? question.options.map(String) : ["", ""],
      answer: Number.isInteger(question.answer) ? Number(question.answer) : 0,
    })) : [],
  };
}

function draftFromCourse(course: Course): CourseDraft {
  return {
    id: course.id,
    titre: course.titre,
    slug: course.slug,
    description: course.description || "",
    image_url: course.image_url || "",
    niveau: course.niveau || "debutant",
    statut: course.statut || "brouillon",
    semestre: Number(course.semestre || 1),
    numero: Number(course.numero || 0),
    prix: eurosFromCents(course.prix),
    prix_reduit: eurosFromCents(course.prix_reduit),
    duree_totale_minutes: Number(course.duree_totale_minutes || course.duree_totale || 0),
    url_paiement_paypal: (course as Course & { url_paiement_paypal?: string | null }).url_paiement_paypal || "",
    objectifs: course.objectifs?.length ? course.objectifs : [""],
    competences: course.competences?.length ? course.competences : [""],
    prerequis: course.prerequis?.length ? course.prerequis : [""],
    modules: course.modules?.length ? course.modules.map(moduleFromDb) : [],
    updated_at: course.updated_at || "",
  };
}

function cleanList(values: string[]) {
  return values.map(value => value.trim()).filter(Boolean);
}

export type CourseDraftIssue = {
  field: "course-title" | "course-slug" | "course-description" | "module-title";
  message: string;
  moduleIndex?: number;
};

export function serializeCourseModules(modules: ModuleDraft[]) {
  return modules.map((module, index) => ({
    ...(module.id ? { id: module.id } : {}),
    titre: module.titre,
    description: module.description,
    contenu_html: module.contenu_html,
    url_video: module.url_video,
    duree: module.duree,
    type_contenu: module.type_contenu,
    ordre: index + 1,
    quiz: (module.quiz || []).map(question => ({
      id: question.id,
      question: question.question,
      options: [...question.options],
      answer: question.answer,
    })),
  }));
}

export function courseDraftSignature(draft: CourseDraft) {
  return JSON.stringify({
    ...draft,
    objectifs: [...draft.objectifs],
    competences: [...draft.competences],
    prerequis: [...draft.prerequis],
    modules: serializeCourseModules(draft.modules),
  });
}

export function validateCourseDraft(draft: CourseDraft): CourseDraftIssue[] {
  const issues: CourseDraftIssue[] = [];
  if (!draft.titre.trim()) issues.push({ field: "course-title", message: "Donnez un titre au cours." });
  if (!draft.slug.trim()) issues.push({ field: "course-slug", message: "Donnez une adresse URL au cours." });
  if (!draft.description.trim()) issues.push({ field: "course-description", message: "Ajoutez une description courte au cours." });
  draft.modules.forEach((module, moduleIndex) => {
    if (!module.titre.trim()) {
      issues.push({ field: "module-title", message: `Donnez un titre au module ${moduleIndex + 1}.`, moduleIndex });
    }
  });
  return issues;
}

export function courseStatusForSave(currentStatus: string, savedStatus: string, explicitPublication: boolean) {
  if (explicitPublication) return "publie";
  if (currentStatus === "publie" && savedStatus !== "publie") return null;
  return currentStatus;
}

export function draftAfterFailedCourseSave(originalDraft: CourseDraft, submittedDraft: CourseDraft, explicitPublication: boolean) {
  return explicitPublication ? { ...submittedDraft, statut: originalDraft.statut } : submittedDraft;
}

function courseFromSaveResponse(value: unknown, fallback: CourseDraft): Course | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = String(record.id || fallback.id || "");
  if (!id) return null;
  const rawModules = Array.isArray(record.modules)
    ? record.modules
    : Array.isArray(record.course_modules)
      ? record.course_modules
      : [];
  const fallbackPrice = Math.round(Number(fallback.prix.replace(",", ".") || 0) * 100);
  const fallbackReducedPrice = Math.round(Number(fallback.prix_reduit.replace(",", ".") || 0) * 100);

  return {
    id,
    titre: String(record.titre ?? fallback.titre),
    slug: String(record.slug ?? fallback.slug),
    description: String(record.description ?? fallback.description),
    image_url: String(record.image_url ?? fallback.image_url) || null,
    niveau: String(record.niveau ?? fallback.niveau),
    statut: String(record.statut ?? fallback.statut),
    semestre: Number(record.semestre ?? fallback.semestre),
    numero: Number(record.numero ?? fallback.numero),
    updated_at: String(record.updated_at ?? fallback.updated_at ?? "") || null,
    prix: Number(record.prix ?? fallbackPrice),
    prix_reduit: Number(record.prix_reduit ?? fallbackReducedPrice),
    duree_totale: Number(record.duree_totale_minutes ?? record.duree_totale ?? fallback.duree_totale_minutes),
    duree_totale_minutes: Number(record.duree_totale_minutes ?? fallback.duree_totale_minutes),
    nb_modules: Number(record.nb_modules || rawModules.length),
    url_paiement_paypal: String(record.url_paiement_paypal ?? fallback.url_paiement_paypal) || null,
    objectifs: Array.isArray(record.objectifs) ? record.objectifs.map(String) : cleanList(fallback.objectifs),
    competences: Array.isArray(record.competences) ? record.competences.map(String) : cleanList(fallback.competences),
    prerequis: Array.isArray(record.prerequis) ? record.prerequis.map(String) : cleanList(fallback.prerequis),
    modules: rawModules.map((module, index) => ({
      ...(module as CourseModule),
      id: String((module as CourseModule).id || ""),
      titre: String((module as CourseModule).titre || `Module ${index + 1}`),
      description: String((module as CourseModule).description || ""),
      duree: Number((module as CourseModule).duree || 0),
      type: String((module as CourseModule).type_contenu || (module as CourseModule).type || "texte"),
    })),
  };
}

function SafeModulePreview({ module }: { module: ModuleDraft }) {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (typeof DOMPurify.sanitize !== "function") {
      setSafeHtml("");
      return;
    }
    setSafeHtml(DOMPurify.sanitize(module.contenu_html, {
      ALLOWED_ATTR: ["href", "title"],
      ALLOWED_TAGS: [
        "a", "b", "blockquote", "br", "code", "details", "div", "em", "figcaption", "figure",
        "h2", "h3", "h4", "hr", "i", "li", "ol", "p", "pre", "section", "span", "strong",
        "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
      ],
      ALLOW_DATA_ATTR: false,
      FORBID_ATTR: ["style"],
      FORBID_TAGS: ["embed", "form", "iframe", "object", "script", "style"],
    }));
  }, [module.contenu_html]);

  return (
    <div className="rich-editor" aria-label={`Aperçu sécurisé de ${module.titre || "ce module"}`}>
      <div
        className="rich-canvas"
        onClick={event => {
          if ((event.target as Element).closest?.("a")) event.preventDefault();
        }}
      >
        {module.description && <p><strong>{module.description}</strong></p>}
        {safeHtml
          ? <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
          : <p className="muted">Ajoutez du contenu pour afficher son aperçu.</p>}
        {module.type_contenu === "video" && /^https:\/\//i.test(module.url_video.trim()) && (
          <p className="muted">Une vidéo HTTPS accompagnera ce module.</p>
        )}
        {module.type_contenu === "quiz" && (
          <div className="course-quiz-preview">
            {(module.quiz || []).length ? (module.quiz || []).map((question, index) => (
              <section key={question.id}>
                <h4>{index + 1}. {question.question || "Question sans intitulé"}</h4>
                <ol type="A">{question.options.map((option, optionIndex) => <li key={optionIndex}>{option || "Réponse à compléter"}</li>)}</ol>
              </section>
            )) : <p className="muted">Ajoutez une question pour prévisualiser le quiz.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [draft, setDraft] = useState<CourseDraft>(emptyDraft);
  const [savedDraft, setSavedDraft] = useState<CourseDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [draggedModule, setDraggedModule] = useState<number | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<CourseEditorSection>("overview");
  const [moduleView, setModuleView] = useState<"edit" | "preview">("edit");
  const [courseSearch, setCourseSearch] = useState("");
  const [pendingRecovery, setPendingRecovery] = useState<CourseDraft | null>(null);
  const [pendingRecoveryStoredAt, setPendingRecoveryStoredAt] = useState<number | null>(null);
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<string | null>(null);
  const [pendingRecoveryWorkspace, setPendingRecoveryWorkspace] = useState<{ activeModuleClientId?: string | null; activeSection?: CourseEditorSection } | null>(null);
  const [pendingRecoveryConflict, setPendingRecoveryConflict] = useState(false);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const [recoveryIdentityReady, setRecoveryIdentityReady] = useState(false);
  const [initialCourseResolving, setInitialCourseResolving] = useState(true);
  const [localDraftStatus, setLocalDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [validationIssue, setValidationIssue] = useState<CourseDraftIssue | null>(null);
  const initialCourseQueryHandled = useRef(false);
  const localModuleSequence = useRef(0);
  const localQuizSequence = useRef(0);
  const localDraftTimer = useRef<number | null>(null);
  const tabIdRef = useRef("");
  const publishRequested = useRef(false);
  const editorFormRef = useRef<HTMLFormElement | null>(null);
  const editorStepsRef = useRef<HTMLElement | null>(null);
  const isDirty = useMemo(() => courseDraftSignature(draft) !== courseDraftSignature(savedDraft), [draft, savedDraft]);
  const readiness = useMemo(() => getCourseEditorReadiness(draft), [draft]);
  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLocaleLowerCase("fr");
    if (!query) return courses;
    return courses.filter(course => [course.titre, course.slug, course.statut]
      .some(value => String(value || "").toLocaleLowerCase("fr").includes(query)));
  }, [courseSearch, courses]);
  const activeModuleIndex = useMemo(() => {
    const index = draft.modules.findIndex(module => module.clientId === expandedModuleId);
    return index >= 0 ? index : draft.modules.length ? 0 : -1;
  }, [draft.modules, expandedModuleId]);
  const activeModule = activeModuleIndex >= 0 ? draft.modules[activeModuleIndex] : null;

  useEffect(() => {
    void refreshCourses();
  }, []);

  useEffect(() => {
    tabIdRef.current = globalThis.crypto?.randomUUID?.() || `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    void (async () => {
      try {
        const response = await authenticatedFetch("/api/auth/user");
        const data = await response.json().catch(() => null) as { user?: { id?: unknown } } | null;
        if (response.ok && data?.user?.id) setRecoveryUserId(String(data.user.id));
      } finally {
        setRecoveryIdentityReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (initialCourseQueryHandled.current || coursesLoading || !recoveryIdentityReady) return;
    initialCourseQueryHandled.current = true;
    const requestedCourse = new URLSearchParams(window.location.search).get("course");
    if (!requestedCourse) {
      inspectLocalRecovery(emptyDraft());
      setInitialCourseResolving(false);
      return;
    }

    const course = courses.find(item => item.id === requestedCourse || item.slug === requestedCourse);
    if (course) selectCourse(course, { confirmDiscard: false, updateUrl: false, shouldScroll: false });
    else inspectLocalRecovery(emptyDraft());
    setInitialCourseResolving(false);
  }, [courses, coursesLoading, recoveryIdentityReady, recoveryUserId]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmLinkNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const href = target.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const nextUrl = new URL(target.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return;
      if (!saving && window.confirm("Abandonner les modifications non enregistrées ?")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [isDirty, saving]);

  useEffect(() => {
    if (isDirty && status === "success") setStatus("idle");
  }, [isDirty, status]);

  useEffect(() => {
    const steps = editorStepsRef.current;
    const activeStep = steps?.querySelector<HTMLElement>("[aria-current='step']");
    if (!steps || !activeStep) return;
    const centeredLeft = activeStep.offsetLeft - ((steps.clientWidth - activeStep.offsetWidth) / 2);
    steps.scrollTo({ behavior: "auto", left: Math.max(0, centeredLeft) });
  }, [activeSection]);

  useEffect(() => {
    if (localDraftTimer.current) window.clearTimeout(localDraftTimer.current);
    if (!isDirty || pendingRecovery || !recoveryUserId || !tabIdRef.current) {
      if (!isDirty) setLocalDraftStatus("idle");
      return;
    }

    setLocalDraftStatus("saving");
    localDraftTimer.current = window.setTimeout(() => {
      persistLocalRecovery(draft, savedDraft, activeSection, expandedModuleId);
    }, 800);

    return () => {
      if (localDraftTimer.current) window.clearTimeout(localDraftTimer.current);
    };
  }, [activeSection, draft, expandedModuleId, isDirty, pendingRecovery, recoveryUserId, savedDraft]);

  useEffect(() => {
    const saveWithKeyboard = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (!saving && isDirty && !pendingRecovery) editorFormRef.current?.requestSubmit();
    };
    document.addEventListener("keydown", saveWithKeyboard);
    return () => document.removeEventListener("keydown", saveWithKeyboard);
  }, [isDirty, pendingRecovery, saving]);

  async function refreshCourses() {
    setCoursesLoading(true);
    try {
      const response = await authenticatedFetch("/api/courses");
      const next = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(next)) {
        const message = next && typeof next === "object" && "error" in next ? String(next.error) : "Les cours n'ont pas pu être chargés.";
        throw new Error(message);
      }
      setCourses(next as Course[]);
      return next as Course[];
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Les cours n'ont pas pu être chargés.");
      setStatus("error");
      return null;
    } finally {
      setCoursesLoading(false);
    }
  }

  function persistLocalRecovery(
    nextDraft: CourseDraft,
    serverDraft: CourseDraft,
    section: CourseEditorSection,
    moduleClientId: string | null,
  ) {
    if (!recoveryUserId || !tabIdRef.current) return;
    try {
      const key = courseDraftRecoveryKey(nextDraft.id, recoveryUserId, tabIdRef.current);
      const recovery = createCourseDraftRecovery(nextDraft, serverDraft, Date.now(), {
        activeModuleClientId: moduleClientId,
        activeSection: section,
      });
      localStorage.setItem(key, JSON.stringify(recovery));
      setLocalDraftStatus("saved");
    } catch {
      setLocalDraftStatus("error");
    }
  }

  function inspectLocalRecovery(serverDraft: CourseDraft) {
    if (!recoveryUserId) {
      setPendingRecovery(null);
      setPendingRecoveryStoredAt(null);
      setPendingRecoveryKey(null);
      setPendingRecoveryWorkspace(null);
      setPendingRecoveryConflict(false);
      return;
    }
    const prefix = courseDraftRecoveryPrefix(serverDraft.id, recoveryUserId);
    try {
      const candidates: { key: string; recovery: NonNullable<ReturnType<typeof parseCourseDraftRecovery<CourseDraft>>> }[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(prefix)) continue;
        const recovery = parseCourseDraftRecovery<CourseDraft>(localStorage.getItem(key), serverDraft);
        if (recovery) candidates.push({ key, recovery });
      }
      const candidate = candidates.sort((first, second) => second.recovery.storedAt - first.recovery.storedAt)[0];
      const recovery = candidate?.recovery;
      if (!recovery) {
        setPendingRecovery(null);
        setPendingRecoveryStoredAt(null);
        setPendingRecoveryKey(null);
        setPendingRecoveryWorkspace(null);
        setPendingRecoveryConflict(false);
        return;
      }
      setPendingRecovery(recovery.draft);
      setPendingRecoveryStoredAt(recovery.storedAt);
      setPendingRecoveryKey(candidate.key);
      setPendingRecoveryWorkspace(recovery.workspace || null);
      setPendingRecoveryConflict(Boolean(recovery.serverConflict));
    } catch {
      setPendingRecovery(null);
      setPendingRecoveryStoredAt(null);
      setPendingRecoveryKey(null);
      setPendingRecoveryWorkspace(null);
      setPendingRecoveryConflict(false);
      setLocalDraftStatus("error");
    }
  }

  function removeLocalRecovery(courseId?: string) {
    if (!recoveryUserId || !tabIdRef.current) return;
    try {
      localStorage.removeItem(courseDraftRecoveryKey(courseId, recoveryUserId, tabIdRef.current));
    } catch {
      setLocalDraftStatus("error");
    }
  }

  function restoreLocalRecovery() {
    if (!pendingRecovery) return;
    const asCopy = pendingRecoveryConflict;
    const recoverySuffix = Date.now().toString(36);
    const restoredDraft = {
      ...pendingRecovery,
      ...(asCopy ? {
        id: undefined,
        updated_at: "",
        statut: "brouillon",
        titre: `${pendingRecovery.titre || "Cours récupéré"} — copie récupérée`,
        slug: `${pendingRecovery.slug || "cours-recupere"}-copie-${recoverySuffix}`.slice(0, 160),
      } : {}),
      modules: pendingRecovery.modules.map((module, index) => ({
        ...module,
        ...(asCopy ? { id: undefined } : {}),
        clientId: asCopy ? `recovered-copy-${Date.now()}-${index}` : module.clientId || `recovered-module-${Date.now()}-${index}`,
        ordre: index + 1,
      })),
    };
    setDraft(restoredDraft);
    if (asCopy) {
      setSavedDraft(emptyDraft());
      replaceCourseQuery(null);
    }
    const restoredModuleId = restoredDraft.modules.some(module => module.clientId === pendingRecoveryWorkspace?.activeModuleClientId)
      ? pendingRecoveryWorkspace?.activeModuleClientId || null
      : restoredDraft.modules[0]?.clientId || null;
    setExpandedModuleId(restoredModuleId);
    setActiveSection(pendingRecoveryWorkspace?.activeSection || (restoredDraft.modules.length ? "modules" : "overview"));
    setModuleView("edit");
    setPendingRecovery(null);
    setPendingRecoveryStoredAt(null);
    setPendingRecoveryKey(null);
    setPendingRecoveryWorkspace(null);
    setPendingRecoveryConflict(false);
    setStatus("idle");
    setError("");
    setValidationIssue(null);
    setLocalDraftStatus("saved");
  }

  function refuseLocalRecovery() {
    try {
      if (pendingRecoveryKey) localStorage.removeItem(pendingRecoveryKey);
    } catch {
      setLocalDraftStatus("error");
    }
    setPendingRecovery(null);
    setPendingRecoveryStoredAt(null);
    setPendingRecoveryKey(null);
    setPendingRecoveryWorkspace(null);
    setPendingRecoveryConflict(false);
    setLocalDraftStatus("idle");
  }

  function markEdited() {
    if (status === "success") setStatus("idle");
    if (validationIssue) setValidationIssue(null);
  }

  function update<K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) {
    markEdited();
    setDraft(current => ({ ...current, [key]: value }));
  }

  function updateList(key: "objectifs" | "competences" | "prerequis", index: number, value: string) {
    markEdited();
    setDraft(current => ({ ...current, [key]: current[key].map((item, i) => i === index ? value : item) }));
  }

  function addListItem(key: "objectifs" | "competences" | "prerequis") {
    if (saving) return;
    markEdited();
    setDraft(current => ({ ...current, [key]: [...current[key], ""] }));
  }

  function removeListItem(key: "objectifs" | "competences" | "prerequis", index: number) {
    if (saving) return;
    markEdited();
    setDraft(current => {
      const next = current[key].filter((_, i) => i !== index);
      return { ...current, [key]: next.length ? next : [""] };
    });
  }

  function updateModule(index: number, patch: Partial<ModuleDraft>) {
    markEdited();
    setDraft(current => ({
      ...current,
      modules: current.modules.map((module, i) => i === index ? { ...module, ...patch } : module),
    }));
  }

  function createQuizQuestion(moduleClientId: string): QuizQuestionDraft {
    return {
      id: `quiz-${moduleClientId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${Date.now()}-${localQuizSequence.current++}`.slice(0, 100),
      question: "",
      options: ["", ""],
      answer: 0,
    };
  }

  function updateModuleQuiz(index: number, updater: (questions: QuizQuestionDraft[]) => QuizQuestionDraft[]) {
    markEdited();
    setDraft(current => ({
      ...current,
      modules: current.modules.map((module, moduleIndex) => moduleIndex === index
        ? { ...module, quiz: updater(module.quiz || []) }
        : module),
    }));
  }

  function changeModuleType(index: number, type: string) {
    if (!draft.modules[index]) return;
    updateModule(index, { type_contenu: type });
  }

  function addQuizQuestion(index: number) {
    const module = draft.modules[index];
    if (!module || (module.quiz || []).length >= 50) return;
    updateModuleQuiz(index, questions => [...questions, createQuizQuestion(module.clientId)]);
  }

  function removeQuizQuestion(moduleIndex: number, questionIndex: number) {
    const question = draft.modules[moduleIndex]?.quiz?.[questionIndex];
    if (!question || !window.confirm(`Supprimer la question ${questionIndex + 1} ?`)) return;
    updateModuleQuiz(moduleIndex, questions => questions.filter((_, index) => index !== questionIndex));
  }

  function updateQuizQuestion(moduleIndex: number, questionIndex: number, patch: Partial<QuizQuestionDraft>) {
    updateModuleQuiz(moduleIndex, questions => questions.map((question, index) => index === questionIndex ? { ...question, ...patch } : question));
  }

  function addQuizOption(moduleIndex: number, questionIndex: number) {
    updateModuleQuiz(moduleIndex, questions => questions.map((question, index) => index === questionIndex && question.options.length < 10
      ? { ...question, options: [...question.options, ""] }
      : question));
  }

  function updateQuizOption(moduleIndex: number, questionIndex: number, optionIndex: number, value: string) {
    updateModuleQuiz(moduleIndex, questions => questions.map((question, index) => index === questionIndex
      ? { ...question, options: question.options.map((option, currentOption) => currentOption === optionIndex ? value : option) }
      : question));
  }

  function removeQuizOption(moduleIndex: number, questionIndex: number, optionIndex: number) {
    updateModuleQuiz(moduleIndex, questions => questions.map((question, index) => {
      if (index !== questionIndex || question.options.length <= 2) return question;
      const options = question.options.filter((_, currentOption) => currentOption !== optionIndex);
      const answer = question.answer === optionIndex
        ? 0
        : question.answer > optionIndex
          ? question.answer - 1
          : question.answer;
      return { ...question, answer, options };
    }));
  }

  function addModule() {
    if (saving) return;
    markEdited();
    const clientId = `local-module-${Date.now()}-${localModuleSequence.current++}`;
    setDraft(current => ({ ...current, modules: [...current.modules, emptyModule(current.modules.length + 1, clientId)] }));
    setExpandedModuleId(clientId);
    setActiveSection("modules");
    setModuleView("edit");
  }

  function removeModule(index: number) {
    if (saving) return;
    const module = draft.modules[index];
    if (!module || !window.confirm(`Supprimer ${module.titre.trim() ? `« ${module.titre.trim()} »` : `le module ${index + 1}`} ? Cette action sera appliquée au prochain enregistrement.`)) return;
    markEdited();
    const next = draft.modules.filter((_, i) => i !== index).map((item, i) => ({ ...item, ordre: i + 1 }));
    setDraft(current => ({ ...current, modules: next }));
    if (expandedModuleId === module.clientId) setExpandedModuleId(next[index]?.clientId || next[index - 1]?.clientId || null);
  }

  function moveModule(from: number, to: number) {
    if (saving || from === to || from < 0 || to < 0 || from >= draft.modules.length || to >= draft.modules.length) return;
    markEdited();
    setDraft(current => {
      const next = [...current.modules];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...current, modules: next.map((module, index) => ({ ...module, ordre: index + 1 })) };
    });
  }

  function replaceCourseQuery(course: Course | null) {
    const url = new URL(window.location.href);
    if (course) url.searchParams.set("course", course.id);
    else url.searchParams.delete("course");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function confirmDiscardChanges() {
    return !isDirty || window.confirm("Abandonner les modifications non enregistrées ?");
  }

  function selectCourse(course: Course, options: { confirmDiscard?: boolean; updateUrl?: boolean; shouldScroll?: boolean } = {}) {
    if (saving) return;
    const { confirmDiscard = true, updateUrl = true, shouldScroll = true } = options;
    if (confirmDiscard && !confirmDiscardChanges()) return;
    const nextDraft = draftFromCourse(course);
    setDraft(nextDraft);
    setSavedDraft(nextDraft);
    setExpandedModuleId(nextDraft.modules[0]?.clientId || null);
    setActiveSection("overview");
    setModuleView("edit");
    setStatus("idle");
    setError("");
    setValidationIssue(null);
    setLocalDraftStatus("idle");
    inspectLocalRecovery(nextDraft);
    if (updateUrl) replaceCourseQuery(course);
    if (shouldScroll) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newCourse() {
    if (saving || !confirmDiscardChanges()) return;
    const nextDraft = emptyDraft();
    setDraft(nextDraft);
    setSavedDraft(nextDraft);
    setExpandedModuleId(null);
    setActiveSection("overview");
    setModuleView("edit");
    setStatus("idle");
    setError("");
    setValidationIssue(null);
    setLocalDraftStatus("idle");
    inspectLocalRecovery(nextDraft);
    replaceCourseQuery(null);
  }

  function cancelChanges() {
    if (saving || !confirmDiscardChanges()) return;
    removeLocalRecovery(draft.id);
    setDraft(savedDraft);
    setExpandedModuleId(savedDraft.modules[0]?.clientId || null);
    setStatus("idle");
    setError("");
    setValidationIssue(null);
    setLocalDraftStatus("idle");
  }

  function toggleModule(clientId: string) {
    if (saving) return;
    setExpandedModuleId(clientId);
    setModuleView("edit");
  }

  function focusIssue(issue: CourseDraftIssue, issueDraft: CourseDraft) {
    if (issue.field === "module-title" && issue.moduleIndex !== undefined) {
      const module = issueDraft.modules[issue.moduleIndex];
      if (module) {
        setActiveSection("modules");
        setExpandedModuleId(module.clientId);
        setModuleView("edit");
      }
    } else {
      setActiveSection("overview");
    }
    window.setTimeout(() => {
      const id = issue.field === "module-title" && issue.moduleIndex !== undefined
        ? `module-${issueDraft.modules[issue.moduleIndex]?.clientId}-title`
        : issue.field;
      const field = document.getElementById(id);
      field?.focus({ preventScroll: true });
      field?.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
    }, 0);
  }

  function requestPublication() {
    if (saving || pendingRecovery || initialCourseResolving) return;
    const firstIncomplete = readiness.items.find(item => !item.complete);
    if (firstIncomplete) {
      setActiveSection(firstIncomplete.section);
      setError(`Publication impossible : ${firstIncomplete.label.toLocaleLowerCase("fr")} reste à compléter.`);
      setStatus("error");
      return;
    }
    if (!window.confirm("Publier ce cours maintenant ? Il deviendra accessible aux étudiants autorisés.")) return;
    publishRequested.current = true;
    editorFormRef.current?.requestSubmit();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || pendingRecovery) return;
    if (localDraftTimer.current) {
      window.clearTimeout(localDraftTimer.current);
      localDraftTimer.current = null;
    }
    const shouldPublish = publishRequested.current;
    const submissionStatus = courseStatusForSave(draft.statut, savedDraft.statut, shouldPublish);
    if (!submissionStatus) {
      setActiveSection("publication");
      setError("Publication explicite requise : utilisez « Publier maintenant » après avoir vérifié la checklist.");
      setStatus("error");
      persistLocalRecovery(draft, savedDraft, "publication", expandedModuleId);
      return;
    }
    const submittedDraft = {
      ...draft,
      slug: draft.slug || slugify(draft.titre),
      statut: submissionStatus,
    };
    if (shouldPublish && readiness.completed !== readiness.total) {
      publishRequested.current = false;
      requestPublication();
      return;
    }
    if (!shouldPublish && submittedDraft.statut === "publie" && savedDraft.statut === "publie" && isDirty
      && !window.confirm("Ce cours est déjà publié. Enregistrer ces modifications les rendra immédiatement visibles aux étudiants. Continuer ?")) {
      return;
    }
    const submittedSection = activeSection;
    const submittedModuleIndex = submittedDraft.modules.findIndex(module => module.clientId === expandedModuleId);
    const issues = validateCourseDraft(submittedDraft);
    if (issues.length) {
      setDraft(submittedDraft);
      setError(issues[0].message);
      setValidationIssue(issues[0]);
      setStatus("error");
      focusIssue(issues[0], submittedDraft);
      publishRequested.current = false;
      return;
    }

    setSaving(true);
    setStatus("saving");
    setError("");
    setValidationIssue(null);

    const form = new FormData();
    form.set("titre", submittedDraft.titre);
    form.set("slug", submittedDraft.slug);
    form.set("description", submittedDraft.description);
    form.set("image_url", submittedDraft.image_url);
    form.set("niveau", submittedDraft.niveau);
    form.set("statut", submittedDraft.statut);
    form.set("semestre", String(submittedDraft.semestre || 1));
    form.set("numero", String(submittedDraft.numero || 0));
    form.set("prix", submittedDraft.prix.replace(",", "."));
    form.set("prix_reduit", submittedDraft.prix_reduit.replace(",", "."));
    form.set("duree_totale_minutes", String(submittedDraft.duree_totale_minutes || 0));
    form.set("url_paiement_paypal", submittedDraft.url_paiement_paypal);
    form.set("objectifs", JSON.stringify(cleanList(submittedDraft.objectifs)));
    form.set("competences", JSON.stringify(cleanList(submittedDraft.competences)));
    form.set("prerequis", JSON.stringify(cleanList(submittedDraft.prerequis)));
    const serializedModules = serializeCourseModules(submittedDraft.modules);
    form.set("modules", JSON.stringify(serializedModules));
    form.set("nb_modules", String(serializedModules.length));
    if (submittedDraft.id && submittedDraft.updated_at) form.set("expected_updated_at", submittedDraft.updated_at);

    try {
      const url = submittedDraft.id ? `/api/courses/${submittedDraft.id}` : "/api/courses";
      const response = await authenticatedFetch(url, { method: submittedDraft.id ? "PATCH" : "POST", body: form });
      const data = await response.json().catch(() => null) as { verified?: boolean; data?: unknown; error?: string } | null;
      if (!response.ok || data?.verified !== true) {
        throw new Error(data?.error || "Le cours n'a pas pu être enregistré.");
      }
      const savedCourse = courseFromSaveResponse(data.data, submittedDraft);
      if (!savedCourse) throw new Error("Le serveur n'a pas renvoyé le cours enregistré.");
      const nextDraft = draftFromCourse(savedCourse);
      setCourses(current => [...current.filter(course => course.id !== savedCourse.id), savedCourse]
        .sort((first, second) => Number(first.numero || 0) - Number(second.numero || 0)));
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setExpandedModuleId(nextDraft.modules[submittedModuleIndex]?.clientId || nextDraft.modules[0]?.clientId || null);
      setActiveSection(submittedSection);
      replaceCourseQuery(savedCourse);
      removeLocalRecovery(submittedDraft.id);
      removeLocalRecovery(savedCourse.id);
      if (!submittedDraft.id) removeLocalRecovery(undefined);
      setPendingRecovery(null);
      setPendingRecoveryStoredAt(null);
      setPendingRecoveryKey(null);
      setPendingRecoveryWorkspace(null);
      setPendingRecoveryConflict(false);
      setLocalDraftStatus("idle");
      setStatus("success");
    } catch (cause) {
      const recoverableDraft = draftAfterFailedCourseSave(draft, submittedDraft, shouldPublish);
      setDraft(recoverableDraft);
      persistLocalRecovery(recoverableDraft, savedDraft, submittedSection, expandedModuleId);
      setError(cause instanceof Error ? cause.message : "Le cours n'a pas pu être enregistré.");
      setStatus("error");
    } finally {
      setSaving(false);
      publishRequested.current = false;
    }
  }

  return (
    <section className="section course-studio-page">
      <div className="container">
        <a href="/admin">← Retour au tableau de bord</a>
        <div className="admin-page-head course-studio-page-head">
          <div>
            <h1 className="title">Gestion des cours</h1>
            <p className="subtitle">Créer, éditer, publier et structurer les modules.</p>
          </div>
          <div className="course-studio-page-actions">
            {draft.id && draft.slug && draft.statut === "publie" && (
              <a className="btn btn-outline" href={`/cours/${draft.slug}`} target="_blank" rel="noopener noreferrer">
                <Eye size={18} aria-hidden="true" /> Lire le cours
              </a>
            )}
            <button className="btn btn-primary" type="button" onClick={newCourse} disabled={saving || initialCourseResolving}>
              <Plus size={18} aria-hidden="true" /> Nouveau cours
            </button>
          </div>
        </div>

        <div id="course-editor-notice">
          <ActionNotice status={status} success="Cours enregistré." error={error} />
        </div>

        <div className="course-admin-layout course-studio-layout">
          <form ref={editorFormRef} className="course-editor card course-studio-editor" onSubmit={submit} noValidate aria-busy={saving}>
            {pendingRecovery && (
              <section className="editor-panel course-recovery-banner" role="alert" aria-labelledby="course-recovery-heading">
                <div className="module-editor-head">
                  <div>
                    <h3 id="course-recovery-heading">{pendingRecoveryConflict ? "Brouillon en conflit protégé" : "Brouillon local disponible"}</h3>
                    <p>
                      {pendingRecoveryConflict
                        ? "Le cours a changé sur le serveur depuis ce brouillon. Il ne sera jamais fusionné ou supprimé automatiquement : vous pouvez l’ouvrir comme un nouveau cours."
                        : "Une version non enregistrée de ce cours a été retrouvée"}
                      {pendingRecoveryStoredAt ? ` (${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(pendingRecoveryStoredAt))})` : ""}.
                    </p>
                  </div>
                  <div className="editor-save-buttons" role="group" aria-label="Choisir le brouillon local">
                    <button type="button" className="btn btn-primary" onClick={restoreLocalRecovery}>{pendingRecoveryConflict ? "Créer une copie" : "Restaurer"}</button>
                    <button type="button" className="btn btn-outline" onClick={refuseLocalRecovery}>Refuser</button>
                  </div>
                </div>
              </section>
            )}

            <fieldset className="course-editor-fields" disabled={saving || Boolean(pendingRecovery) || initialCourseResolving}>
              <div className="course-studio-mobile-switch">
                <label htmlFor="course-mobile-switch">Cours actif</label>
                <select
                  id="course-mobile-switch"
                  className="input"
                  value={draft.id || ""}
                  onChange={event => {
                    const course = courses.find(item => item.id === event.target.value);
                    if (course) selectCourse(course);
                    else newCourse();
                  }}
                >
                  <option value="">Nouveau cours</option>
                  {courses.map(course => <option key={course.id} value={course.id}>{course.titre}</option>)}
                </select>
              </div>
              <div className="course-editor-head course-studio-commandbar">
                <div>
                  <span className="badge">{draft.id ? draft.statut === "publie" ? "Cours publié" : "Modification" : "Création"}</span>
                  <h2 className="font-display">{draft.titre || (draft.id ? "Cours sélectionné" : "Nouveau cours")}</h2>
                  <div className="course-editor-state" aria-live="polite" style={{ justifyItems: "start", textAlign: "left" }}>
                    {initialCourseResolving
                      ? <span>Chargement du cours demandé…</span>
                      : saving
                      ? <span>Enregistrement sur le serveur…</span>
                      : isDirty
                        ? <span className="editor-dirty-dot">Modifications non enregistrées</span>
                        : <span>À jour</span>}
                    {localDraftStatus === "saving" && <small>Sauvegarde locale en cours…</small>}
                    {localDraftStatus === "saved" && <small>Brouillon local enregistré sur cet appareil.</small>}
                    {localDraftStatus === "error" && <small>Le brouillon local n’a pas pu être enregistré.</small>}
                  </div>
                </div>
                <div className="editor-save-buttons" role="group" aria-label="Commandes du cours">
                  <button className="btn btn-primary" disabled={saving || !isDirty || Boolean(pendingRecovery)} aria-keyshortcuts="Control+S Meta+S" title="Enregistrer (Ctrl ou ⌘ + S)">
                    <Save size={18} aria-hidden="true" /> {saving ? "Enregistrement…" : draft.statut === "publie" ? "Mettre à jour" : draft.id ? "Enregistrer" : "Créer"}
                  </button>
                  <button className="btn btn-outline" type="button" onClick={cancelChanges} disabled={saving || !isDirty || Boolean(pendingRecovery)}>
                    <X size={18} aria-hidden="true" /> Annuler
                  </button>
                </div>
              </div>

              <nav ref={editorStepsRef} className="course-studio-steps" aria-label="Étapes de création du cours">
                {editorSections.map(section => {
                  const complete = getCourseEditorSectionStatus(draft, section.id);
                  const active = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      className={`course-studio-step ${active ? "active" : ""}`}
                      aria-current={active ? "step" : undefined}
                      onClick={() => setActiveSection(section.id)}
                    >
                      <span className="course-list-title">
                        {complete && <Check size={17} aria-label="Étape complète" />}
                        {section.label}
                      </span>
                      <span className="muted">{section.description}</span>
                    </button>
                  );
                })}
              </nav>

              {activeSection === "overview" && (
                <section className="editor-panel course-studio-panel" aria-labelledby="course-information-heading">
                  <div className="editor-panel-heading">
                    <div>
                      <h3 id="course-information-heading">Vue d’ensemble</h3>
                      <p>Le titre, l’adresse et le résumé présentés aux étudiants.</p>
                    </div>
                  </div>
                  <div className="grid-2">
                    <p><label htmlFor="course-title">Titre du cours *</label><input id="course-title" className="input" value={draft.titre} aria-invalid={validationIssue?.field === "course-title"} aria-describedby={validationIssue?.field === "course-title" ? "course-title-error" : undefined} onChange={event => update("titre", event.target.value)} onBlur={() => !draft.slug && update("slug", slugify(draft.titre))} />{validationIssue?.field === "course-title" && <span id="course-title-error" className="editor-field-error">{validationIssue.message}</span>}</p>
                    <p><label htmlFor="course-slug">Slug URL *</label><input id="course-slug" className="input" value={draft.slug} aria-invalid={validationIssue?.field === "course-slug"} aria-describedby={validationIssue?.field === "course-slug" ? "course-slug-error" : undefined} onChange={event => update("slug", slugify(event.target.value))} autoCapitalize="none" spellCheck={false} />{validationIssue?.field === "course-slug" && <span id="course-slug-error" className="editor-field-error">{validationIssue.message}</span>}</p>
                  </div>
                  <p><label htmlFor="course-description">Description courte *</label><textarea id="course-description" className="input" rows={5} value={draft.description} aria-invalid={validationIssue?.field === "course-description"} aria-describedby={validationIssue?.field === "course-description" ? "course-description-error" : undefined} onChange={event => update("description", event.target.value)} />{validationIssue?.field === "course-description" && <span id="course-description-error" className="editor-field-error">{validationIssue.message}</span>}</p>
                  <p><label htmlFor="course-image">Image de couverture</label><input id="course-image" className="input" type="url" value={draft.image_url} onChange={event => update("image_url", event.target.value)} placeholder="https://… ou /images/…" inputMode="url" /></p>
                </section>
              )}

              {activeSection === "pedagogy" && (
                <section className="editor-panel course-studio-panel" aria-labelledby="course-teaching-heading">
                  <div className="editor-panel-heading">
                    <div>
                      <h3 id="course-teaching-heading">Repères pédagogiques</h3>
                      <p>Expliquez ce que l’étudiant saura comprendre, mobiliser et mettre en pratique.</p>
                    </div>
                  </div>
                  <CourseListEditor idPrefix="course-objective" title="Objectifs pédagogiques" values={draft.objectifs} onAdd={() => addListItem("objectifs")} onChange={(index, value) => updateList("objectifs", index, value)} onRemove={index => removeListItem("objectifs", index)} />
                  <CourseListEditor idPrefix="course-skill" title="Compétences" values={draft.competences} onAdd={() => addListItem("competences")} onChange={(index, value) => updateList("competences", index, value)} onRemove={index => removeListItem("competences", index)} />
                  <CourseListEditor idPrefix="course-prerequisite" title="Prérequis" values={draft.prerequis} onAdd={() => addListItem("prerequis")} onChange={(index, value) => updateList("prerequis", index, value)} onRemove={index => removeListItem("prerequis", index)} />
                </section>
              )}

              {activeSection === "modules" && (
                <section className="editor-panel module-panel course-studio-panel course-program-panel" aria-labelledby="course-modules-heading">
                  <div className="module-editor-head">
                    <div>
                      <h3 id="course-modules-heading">Programme du cours</h3>
                      <p>{draft.modules.length ? `${draft.modules.length} module${draft.modules.length > 1 ? "s" : ""}. Sélectionnez-en un pour l’éditer sans perdre votre position.` : "Commencez par créer le premier module."}</p>
                    </div>
                    <button type="button" className="btn btn-outline" onClick={addModule}><Plus size={16} aria-hidden="true" /> Ajouter un module</button>
                  </div>

                  {!draft.modules.length && (
                    <div className="module-empty-state">
                      <FileText size={24} aria-hidden="true" />
                      <p>Ce cours ne contient encore aucun module.</p>
                      <button type="button" className="btn btn-outline" onClick={addModule}><Plus size={16} aria-hidden="true" /> Créer le premier module</button>
                    </div>
                  )}

                  {activeModule && (
                    <div className="course-admin-layout course-program-workspace">
                      <article className="module-editor is-expanded course-program-editor" aria-labelledby={`module-${activeModule.clientId}-editor-heading`}>
                        <div className="module-editor-summary">
                          <span className="badge module-drag-handle" style={{ cursor: "default" }}>{activeModuleIndex + 1}</span>
                          <div className="module-editor-toggle" id={`module-${activeModule.clientId}-editor-heading`}>
                            <span>
                              <strong>{activeModule.titre.trim() || `Module ${activeModuleIndex + 1} sans titre`}</strong>
                              <small>{activeModule.type_contenu || "texte"} · {activeModule.duree || 0} min</small>
                            </span>
                          </div>
                          <div className="module-editor-actions" role="group" aria-label="Mode d’affichage du module">
                            <button type="button" className={`btn btn-outline ${moduleView === "edit" ? "active" : ""}`} aria-pressed={moduleView === "edit"} onClick={() => setModuleView("edit")}>Édition</button>
                            <button type="button" className={`btn btn-outline ${moduleView === "preview" ? "active" : ""}`} aria-pressed={moduleView === "preview"} onClick={() => setModuleView("preview")}><Eye size={16} aria-hidden="true" /> Aperçu</button>
                          </div>
                        </div>
                        <div id={`module-${activeModule.clientId}-body`} className="module-editor-body">
                          {moduleView === "edit" ? (
                            <>
                              <div className="grid-2">
                                <p><label htmlFor={`module-${activeModule.clientId}-title`}>Titre du module *</label><input id={`module-${activeModule.clientId}-title`} className="input" value={activeModule.titre} aria-invalid={validationIssue?.field === "module-title" && validationIssue.moduleIndex === activeModuleIndex} aria-describedby={validationIssue?.field === "module-title" && validationIssue.moduleIndex === activeModuleIndex ? `module-${activeModule.clientId}-title-error` : undefined} onChange={event => updateModule(activeModuleIndex, { titre: event.target.value })} />{validationIssue?.field === "module-title" && validationIssue.moduleIndex === activeModuleIndex && <span id={`module-${activeModule.clientId}-title-error`} className="editor-field-error">{validationIssue.message}</span>}</p>
                                <p><label htmlFor={`module-${activeModule.clientId}-type`}>Type de contenu</label><select id={`module-${activeModule.clientId}-type`} className="input" value={activeModule.type_contenu} onChange={event => changeModuleType(activeModuleIndex, event.target.value)}><option value="texte">Texte</option><option value="video">Vidéo</option><option value="quiz">Quiz</option></select></p>
                              </div>
                              <p><label htmlFor={`module-${activeModule.clientId}-description`}>Description</label><textarea id={`module-${activeModule.clientId}-description`} className="input" rows={3} value={activeModule.description} onChange={event => updateModule(activeModuleIndex, { description: event.target.value })} /></p>
                              <div className={activeModule.type_contenu === "video" ? "grid-2" : "grid-1"}>
                                <p><label htmlFor={`module-${activeModule.clientId}-duration`}>Durée (min)</label><input id={`module-${activeModule.clientId}-duration`} className="input" type="number" min={0} value={activeModule.duree} onChange={event => updateModule(activeModuleIndex, { duree: Number(event.target.value) })} /></p>
                                {activeModule.type_contenu === "video" && <p><label htmlFor={`module-${activeModule.clientId}-video`}>URL vidéo HTTPS</label><input id={`module-${activeModule.clientId}-video`} className="input" type="url" inputMode="url" value={activeModule.url_video} onChange={event => updateModule(activeModuleIndex, { url_video: event.target.value })} placeholder="https://…" /></p>}
                              </div>
                              {activeModule.type_contenu === "quiz" && (
                                <section className="course-quiz-builder" aria-labelledby={`module-${activeModule.clientId}-quiz-heading`}>
                                  <div className="module-editor-head">
                                    <div>
                                      <h4 id={`module-${activeModule.clientId}-quiz-heading`}>Questions du quiz</h4>
                                      <p>Choisissez une seule bonne réponse par question. Deux réponses minimum sont requises.</p>
                                    </div>
                                    <button type="button" className="btn btn-outline" onClick={() => addQuizQuestion(activeModuleIndex)} disabled={(activeModule.quiz || []).length >= 50}>
                                      <Plus size={16} aria-hidden="true" /> Ajouter une question
                                    </button>
                                  </div>
                                  {(activeModule.quiz || []).map((question, questionIndex) => (
                                    <fieldset className="course-quiz-question" key={question.id}>
                                      <legend>Question {questionIndex + 1}</legend>
                                      <div className="course-quiz-question-head">
                                        <p>
                                          <label htmlFor={`${question.id}-label`}>Intitulé de la question</label>
                                          <textarea id={`${question.id}-label`} className="input" rows={2} value={question.question} onChange={event => updateQuizQuestion(activeModuleIndex, questionIndex, { question: event.target.value })} />
                                        </p>
                                        <button type="button" className="icon-button danger" aria-label={`Supprimer la question ${questionIndex + 1}`} onClick={() => removeQuizQuestion(activeModuleIndex, questionIndex)}>
                                          <Trash2 size={18} aria-hidden="true" />
                                        </button>
                                      </div>
                                      <div className="course-quiz-options" role="group" aria-label={`Réponses de la question ${questionIndex + 1}`}>
                                        {question.options.map((option, optionIndex) => (
                                          <div className="course-quiz-option" key={optionIndex}>
                                            <label className="course-quiz-correct-choice" title="Marquer comme bonne réponse">
                                              <input type="radio" name={`${question.id}-answer`} checked={question.answer === optionIndex} onChange={() => updateQuizQuestion(activeModuleIndex, questionIndex, { answer: optionIndex })} />
                                              <span>Bonne réponse</span>
                                            </label>
                                            <input id={`${question.id}-option-${optionIndex}`} className="input" aria-label={`Réponse ${optionIndex + 1}`} value={option} onChange={event => updateQuizOption(activeModuleIndex, questionIndex, optionIndex, event.target.value)} placeholder={`Réponse ${optionIndex + 1}`} />
                                            <button type="button" className="icon-button" aria-label={`Supprimer la réponse ${optionIndex + 1}`} disabled={question.options.length <= 2} onClick={() => removeQuizOption(activeModuleIndex, questionIndex, optionIndex)}>
                                              <X size={17} aria-hidden="true" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      <button type="button" className="btn btn-outline course-quiz-add-option" onClick={() => addQuizOption(activeModuleIndex, questionIndex)} disabled={question.options.length >= 10}>
                                        <Plus size={16} aria-hidden="true" /> Ajouter une réponse
                                      </button>
                                    </fieldset>
                                  ))}
                                  {!(activeModule.quiz || []).length && (
                                    <div className="module-empty-state">
                                      <p>Ce quiz ne contient aucune question.</p>
                                      <button type="button" className="btn btn-outline" onClick={() => addQuizQuestion(activeModuleIndex)}><Plus size={16} aria-hidden="true" /> Ajouter la première question</button>
                                    </div>
                                  )}
                                </section>
                              )}
                              <div className="module-content-field">
                                <label id={`module-${activeModule.clientId}-content-label`}>{activeModule.type_contenu === "quiz" ? "Introduction du quiz (facultative)" : activeModule.type_contenu === "video" ? "Texte d’accompagnement (facultatif si la vidéo est renseignée)" : "Contenu du module"}</label>
                                <RichHtmlEditor id={`module-${activeModule.clientId}-content`} label={`Contenu du module ${activeModuleIndex + 1}`} value={activeModule.contenu_html} disabled={saving} onChange={value => updateModule(activeModuleIndex, { contenu_html: value })} />
                              </div>
                            </>
                          ) : <SafeModulePreview module={activeModule} />}
                        </div>
                      </article>

                      <aside className="course-list-panel course-program-outline" aria-labelledby="module-outline-heading">
                        <h4 id="module-outline-heading" className="font-display">Plan du cours</h4>
                        <div className="course-list">
                          {draft.modules.map((module, index) => {
                            const moduleBaseId = `module-${module.clientId}`;
                            const current = index === activeModuleIndex;
                            return (
                              <article
                                className={`module-editor ${current ? "is-expanded" : ""}`}
                                key={module.clientId}
                                onDragOver={event => event.preventDefault()}
                                onDrop={() => {
                                  if (draggedModule !== null) moveModule(draggedModule, index);
                                  setDraggedModule(null);
                                }}
                                onDragEnd={() => setDraggedModule(null)}
                              >
                                <div className="module-editor-summary">
                                  <span className="badge module-drag-handle" draggable={!saving} onDragStart={() => setDraggedModule(index)} title="Déplacer le module">
                                    <GripVertical size={16} aria-hidden="true" /> {index + 1}
                                  </span>
                                  <button id={`${moduleBaseId}-toggle`} type="button" className="module-editor-toggle" aria-current={current ? "true" : undefined} aria-controls={current ? `module-${module.clientId}-body` : undefined} onClick={() => toggleModule(module.clientId)}>
                                    <span>
                                      <strong>{module.titre.trim() || `Module ${index + 1} sans titre`}</strong>
                                      <small>{module.type_contenu || "texte"} · {module.duree || 0} min</small>
                                    </span>
                                    {current && <Check size={18} aria-hidden="true" />}
                                  </button>
                                  <div className="module-editor-actions" role="group" aria-label={`Actions du module ${index + 1}`}>
                                    <button type="button" className="icon-button" aria-label={`Monter le module ${index + 1}`} onClick={() => moveModule(index, index - 1)} disabled={index === 0}>↑</button>
                                    <button type="button" className="icon-button" aria-label={`Descendre le module ${index + 1}`} onClick={() => moveModule(index, index + 1)} disabled={index === draft.modules.length - 1}>↓</button>
                                    <button type="button" className="icon-button danger" aria-label={`Supprimer le module ${index + 1}`} onClick={() => removeModule(index)}><Trash2 size={18} aria-hidden="true" /></button>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </aside>
                    </div>
                  )}
                </section>
              )}

              {activeSection === "publication" && (
                <section className="editor-panel course-studio-panel course-publication-panel" aria-labelledby="course-settings-heading">
                  <div className="editor-panel-heading">
                    <div>
                      <h3 id="course-settings-heading">Publication</h3>
                      <p>Vérifiez la qualité du cours, puis réglez sa visibilité et ses informations tarifaires.</p>
                    </div>
                  </div>

                  <div className="module-editor" aria-labelledby="publication-checklist-heading">
                    <div className="module-editor-body">
                      <h4 id="publication-checklist-heading">Checklist avant diffusion — {readiness.completed}/{readiness.total}</h4>
                      <div className="course-list">
                        {readiness.items.map(item => (
                          <button key={item.id} type="button" className={`course-list-item ${item.complete ? "active" : ""}`} onClick={() => setActiveSection(item.section)}>
                            <span className="course-list-title">{item.complete ? <Check size={18} aria-hidden="true" /> : <span aria-hidden="true">○</span>} {item.label}</span>
                            <span className="muted">{item.complete ? "Prêt" : "À compléter"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid-4">
                    <p><label htmlFor="course-status">Statut de travail</label><select id="course-status" className="input" value={draft.statut} onChange={event => update("statut", event.target.value)}><option value="brouillon">Brouillon</option><option value="en_preparation">En préparation</option>{draft.statut === "publie" && <option value="publie">Publié — actuellement visible</option>}<option value="archive">Archivé</option></select></p>
                    <p><label htmlFor="course-level">Niveau</label><select id="course-level" className="input" value={draft.niveau} onChange={event => update("niveau", event.target.value)}><option value="debutant">Débutant</option><option value="intermediaire">Intermédiaire</option><option value="avance">Avancé</option></select></p>
                    <p><label htmlFor="course-semester">Semestre</label><input id="course-semester" className="input" type="number" min={1} value={draft.semestre} onChange={event => update("semestre", Number(event.target.value))} /></p>
                    <p><label htmlFor="course-order">Ordre</label><input id="course-order" className="input" type="number" min={0} value={draft.numero} onChange={event => update("numero", Number(event.target.value))} /></p>
                  </div>
                  <div className="grid-3">
                    <p><label htmlFor="course-price">Prix normal (€)</label><input id="course-price" className="input" inputMode="decimal" value={draft.prix} onChange={event => update("prix", event.target.value)} /></p>
                    <p><label htmlFor="course-reduced-price">Prix réduit (€)</label><input id="course-reduced-price" className="input" inputMode="decimal" value={draft.prix_reduit} onChange={event => update("prix_reduit", event.target.value)} /></p>
                    <p><label htmlFor="course-duration">Durée totale (min)</label><input id="course-duration" className="input" type="number" min={0} value={draft.duree_totale_minutes} onChange={event => update("duree_totale_minutes", Number(event.target.value))} /></p>
                  </div>
                  <p><label htmlFor="course-payment-url">URL de paiement</label><input id="course-payment-url" className="input" type="url" inputMode="url" value={draft.url_paiement_paypal} onChange={event => update("url_paiement_paypal", event.target.value)} placeholder="https://…" /></p>
                  <div className={`course-publication-action ${readiness.completed === readiness.total ? "is-ready" : ""}`}>
                    <div>
                      <strong>{draft.statut === "publie" ? "Cours actuellement publié" : "Diffusion aux étudiants"}</strong>
                      <p>{readiness.completed === readiness.total ? "Toutes les vérifications sont validées. La publication reste une action explicite et confirmée." : `Encore ${readiness.total - readiness.completed} vérification${readiness.total - readiness.completed > 1 ? "s" : ""} avant publication.`}</p>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={requestPublication} disabled={saving || readiness.completed !== readiness.total}>
                      <Check size={18} aria-hidden="true" /> {draft.statut === "publie" ? "Confirmer et republier" : "Publier maintenant"}
                    </button>
                  </div>
                </section>
              )}

              {isDirty && !pendingRecovery && (
                <div className="course-studio-mobile-save" aria-live="polite">
                  <span>{localDraftStatus === "saved" ? "Brouillon local protégé" : "Modifications à enregistrer"}</span>
                  <div className="course-studio-mobile-save-actions">
                    <button className="btn btn-primary" disabled={saving}>
                      <Save size={18} aria-hidden="true" /> {saving ? "Enregistrement…" : draft.statut === "publie" ? "Mettre à jour" : "Enregistrer"}
                    </button>
                    <button className="icon-button" type="button" aria-label="Annuler les modifications" onClick={cancelChanges} disabled={saving}>
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </fieldset>
          </form>

          <aside className="course-list-panel course-studio-library" aria-labelledby="course-list-heading">
            <h2 id="course-list-heading" className="font-display">Cours existants</h2>
            <p>
              <label htmlFor="course-search"><Search size={16} aria-hidden="true" /> Rechercher un cours</label>
              <input id="course-search" className="input" type="search" value={courseSearch} onChange={event => setCourseSearch(event.target.value)} placeholder="Titre, slug ou statut" autoComplete="off" />
            </p>
            <div className="course-list">
              {coursesLoading && (
                <div className="course-list-loading">
                  <Loader2 className="action-spin" size={22} aria-hidden="true" />
                  <span>Chargement des cours...</span>
                </div>
              )}
              {!coursesLoading && filteredCourses.map(course => (
                <button className={`course-list-item ${course.id === draft.id ? "active" : ""}`} key={course.id} type="button" onClick={() => selectCourse(course)} disabled={saving} aria-current={course.id === draft.id ? "true" : undefined}>
                  <span className="course-list-title"><FileText size={18} aria-hidden="true" /> {course.titre}</span>
                  <span className="muted">{course.modules?.length || course.nb_modules || 0} modules · {course.statut || "brouillon"}</span>
                  {course.id === draft.id && <Check size={18} aria-hidden="true" />}
                </button>
              ))}
              {!coursesLoading && !courses.length && (
                <div className="course-list-loading">
                  <FileText size={22} aria-hidden="true" />
                  <span>Aucun cours pour le moment.</span>
                </div>
              )}
              {!coursesLoading && courses.length > 0 && !filteredCourses.length && (
                <div className="course-list-loading">
                  <Search size={22} aria-hidden="true" />
                  <span>Aucun cours ne correspond à cette recherche.</span>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function CourseListEditor({ idPrefix, title, values, onAdd, onChange, onRemove }: {
  idPrefix: string;
  title: string;
  values: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="list-editor">
      <div className="module-editor-head">
        <h3>{title}</h3>
        <button type="button" className="btn btn-outline" aria-label={`Ajouter ${title.toLowerCase()}`} onClick={onAdd}><Plus size={16} aria-hidden="true" /> Ajouter</button>
      </div>
      {values.map((item, index) => (
        <div className="list-row" key={index}>
          <div className="list-row-field">
            <label htmlFor={`${idPrefix}-${index}`}>{title} {index + 1}</label>
            <input id={`${idPrefix}-${index}`} className="input" value={item} onChange={event => onChange(index, event.target.value)} />
          </div>
          <button type="button" className="icon-button" onClick={() => onRemove(index)} aria-label={`Supprimer ${title.toLowerCase()} ${index + 1}`}><Trash2 size={16} aria-hidden="true" /></button>
        </div>
      ))}
    </div>
  );
}
