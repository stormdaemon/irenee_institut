"use client";

import Link from "next/link";
import DOMPurify from "dompurify";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Film,
  Loader2,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getModuleNavigation, getSafeCourseAssetUrl } from "@/components/course-reader-utils";
import {
  buildCourseJourney,
  defaultReaderPreferences,
  parseReaderPreferences,
  type ReaderPreferences,
} from "@/lib/course-experience";
import { createBrowserClient } from "@/lib/supabase";
import type { Course, CourseModule, ModuleProgress } from "@/lib/types";

type StudentCourse = Course & {
  progress?: number;
  completedModules?: number;
};

type ModulePayload = {
  courses: StudentCourse[];
  progress: ModuleProgress[];
};

type ModuleStatus = "loading" | "ready" | "locked" | "unauthenticated" | "error";
type ModuleStartStatus = "idle" | "pending" | "ready" | "error";

type Resource = {
  label: string;
  url: string;
};

const moduleFrameThemeCss = `
  html { background: #fffaf0; }
  body {
    color: #172033;
    background: #fffaf0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 18px;
    line-height: 1.72;
    padding: 30px;
  }
  .module-content,
  .module-content *,
  body > * { color: #172033 !important; }
  .module-content {
    display: flow-root;
    width: 100%;
    max-width: 72ch;
    margin: 0 auto;
  }
  .module-content h2,
  .module-content h3,
  .module-content h4,
  h1, h2, h3, h4 {
    color: #071d49 !important;
    line-height: 1.18;
    overflow-wrap: anywhere;
  }
  p, li, blockquote, td, th, span, strong, em {
    color: #172033 !important;
  }
  a {
    color: #7a1717 !important;
    font-weight: 800;
  }
  img, video, iframe {
    max-width: 100% !important;
    height: auto !important;
  }
  table {
    display: block;
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: auto;
    border-collapse: collapse;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    box-shadow: inset -14px 0 12px -12px rgba(7,29,73,.35);
  }
  table::-webkit-scrollbar { height: 6px; }
  table::-webkit-scrollbar-thumb { background: #b88a3a; border-radius: 3px; }
  th, td {
    min-width: clamp(96px, 26vw, 160px);
    padding: 12px 14px;
    border: 1px solid #d9cba9;
    overflow-wrap: anywhere;
    vertical-align: top;
  }
  .module-content ul.styled-list li::before { color: #7a1717 !important; }
  .module-content :is(.definition-box, .quote-box, .biblical-quote, .note-box, .warning-box, .success-box, .example-box) {
    color: #172033 !important;
    background: #fff3d8 !important;
    border-color: #b88a3a !important;
  }
  .module-content :is(.definition-box, .quote-box, .biblical-quote, .note-box, .warning-box, .success-box, .example-box)
    :is(h2, h3, h4, p, li, strong, em, span) {
    color: inherit !important;
  }
  .module-content .comparison-table,
  .module-content .comparison-table tbody,
  .module-content .comparison-table td { color: #182235 !important; }
  .module-content .comparison-table thead,
  .module-content .comparison-table th { color: #ffffff !important; background: #071d49 !important; }
  @media (max-width: 640px) {
    body {
      font-size: 17px;
      line-height: 1.68;
      padding: 20px;
    }
    h1 { font-size: 1.8rem !important; }
    h2 { font-size: 1.5rem !important; }
    h3 { font-size: 1.25rem !important; }
    p, li { overflow-wrap: anywhere; }
    .module-responsive-table,
    .module-responsive-table thead,
    .module-responsive-table tbody,
    .module-responsive-table tr,
    .module-responsive-table th,
    .module-responsive-table td {
      display: block !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
    }
    .module-responsive-table {
      overflow: visible !important;
      border: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    .module-responsive-table thead {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      overflow: hidden !important;
      clip-path: inset(50%) !important;
      white-space: nowrap !important;
    }
    .module-responsive-table tbody tr {
      margin: 0 0 18px !important;
      border: 1px solid #d9c28f !important;
      border-radius: 10px !important;
      background: #fffdf7 !important;
      overflow: hidden !important;
    }
    .module-responsive-table td {
      padding: 16px 18px !important;
      border: 0 !important;
      border-top: 1px solid #eadbb7 !important;
      background: transparent !important;
    }
    .module-responsive-table td:first-child {
      border-top: 0 !important;
    }
    .module-responsive-table td::before {
      content: attr(data-label);
      display: block;
      margin-bottom: 7px;
      color: #071d49;
      font-weight: 800;
      font-style: normal;
    }
  }
`;

function sanitizeModuleHtml(html: string) {
  const normalizedHtml = html.replace(
    /<div(\s+[^>]*class=["'][^"']*\bcomparison-table\b[^"']*["'][^>]*)>/gi,
    "<table$1>"
  );
  const document = new DOMParser().parseFromString(DOMPurify.sanitize(normalizedHtml, {
    FORBID_TAGS: [
      "base", "button", "embed", "form", "iframe", "input", "link", "math", "meta", "object",
      "option", "script", "select", "style", "svg", "textarea",
    ],
  }), "text/html");
  document.querySelectorAll<HTMLElement>("[style]").forEach(element => {
    element.removeAttribute("style");
  });
  document.querySelectorAll<HTMLElement>(".comparison-table:not(table)").forEach(element => {
    element.classList.remove("comparison-table");
  });
  document.querySelectorAll<HTMLTableElement>("table").forEach(table => {
    table.classList.add("module-responsive-table");
    const headers = Array.from(table.querySelectorAll("thead th")).map(header => header.textContent?.trim() || "");
    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach(row => {
      Array.from(row.children).forEach((cell, index) => {
        if (headers[index]) cell.setAttribute("data-label", headers[index]);
      });
    });
  });
  return document.body.innerHTML;
}

function ModuleHtmlContent({ html, preferences, title }: { html: string; preferences: ReaderPreferences; title: string }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const document = useMemo(() => {
    const sanitizedHtml = sanitizeModuleHtml(html);
    const preferenceCss = `
      body { font-size: ${preferences.fontScale === "small" ? "16px" : preferences.fontScale === "large" ? "20px" : "18px"}; }
      .module-content { max-width: ${preferences.measure === "focused" ? "60ch" : "72ch"}; }
      @media (max-width: 640px) {
        body { font-size: ${preferences.fontScale === "small" ? "16px" : preferences.fontScale === "large" ? "19px" : "17px"}; }
      }
    `;
    return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: data:; media-src 'self' https:; style-src 'unsafe-inline'; font-src 'none'; form-action 'none'" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html,body{margin:0;padding:0}body{overflow-wrap:anywhere}table{max-width:100%}</style>
    <style>${moduleFrameThemeCss}</style>
    <style>${preferenceCss}</style>
  </head>
  <body><main class="module-content">${sanitizedHtml}</main></body>
</html>`;
  }, [html, preferences]);

  const syncHeight = useCallback(() => {
    const frame = frameRef.current;
    const body = frame?.contentDocument?.body;
    const content = frame?.contentDocument?.querySelector<HTMLElement>(".module-content");
    const frameWindow = frame?.contentWindow;
    if (!frame || !body || !content || !frameWindow) return;
    const bodyStyle = frameWindow.getComputedStyle(body);
    const verticalPadding = Number.parseFloat(bodyStyle.paddingTop || "0") + Number.parseFloat(bodyStyle.paddingBottom || "0");
    const contentHeight = Math.max(content.scrollHeight, Math.ceil(content.getBoundingClientRect().height));
    frame.style.height = `${Math.max(160, Math.ceil(contentHeight + verticalPadding))}px`;
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const doc = frame.contentDocument;
    const observer = new ResizeObserver(syncHeight);
    if (doc?.body) observer.observe(doc.body);
    if (doc?.documentElement) observer.observe(doc.documentElement);
    doc?.querySelectorAll("img").forEach(image => {
      if (!image.complete) image.addEventListener("load", syncHeight, { once: true });
    });
    doc?.fonts?.ready.then(syncHeight).catch(() => undefined);
    const delayedSync = window.setTimeout(syncHeight, 300);
    window.addEventListener("resize", syncHeight);
    return () => {
      window.clearTimeout(delayedSync);
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, [syncHeight, document]);

  return (
    <iframe
      ref={frameRef}
      className="module-html-frame"
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      srcDoc={document}
      title={`Contenu du module : ${title}`}
      onLoad={syncHeight}
    />
  );
}

function getResources(module: CourseModule): Resource[] {
  if (!Array.isArray(module.ressources)) return [];
  return module.ressources
    .map((item, index) => {
      if (typeof item === "string") {
        const url = getSafeCourseAssetUrl(item);
        return url ? { label: `Ressource ${index + 1}`, url } : null;
      }
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const url = getSafeCourseAssetUrl(String(record.url || record.href || ""));
      if (!url) return null;
      return { label: String(record.label || record.titre || record.title || `Ressource ${index + 1}`), url };
    })
    .filter(Boolean) as Resource[];
}

function AccessibleModuleVideo({ module, url }: { module: CourseModule; url: string }) {
  const summaryId = useId();
  const textAlternative = module.contenu?.trim()
    || module.description?.trim()
    || "Aucun résumé textuel n'est encore disponible pour cette vidéo.";

  return (
    <section className="card module-video-section" aria-labelledby={`${summaryId}-title`}>
      <div className="module-video-heading">
        <Film size={22} aria-hidden="true" />
        <h2 id={`${summaryId}-title`}>Vidéo du module</h2>
      </div>
      <video
        className="module-video-player"
        controls
        playsInline
        preload="metadata"
        aria-label={`Vidéo : ${module.titre}`}
        aria-describedby={summaryId}
      >
        <source src={url} />
        Votre navigateur ne peut pas lire cette vidéo.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer">Ouvrir la vidéo dans un nouvel onglet</a>.
      </video>
      <details className="module-video-transcript">
        <summary>Résumé textuel de la vidéo</summary>
        <p id={summaryId}>{textAlternative}</p>
        {module.contenu_html && <p>Le contenu textuel détaillé est disponible juste sous la vidéo.</p>}
      </details>
    </section>
  );
}

function CoursePlan({ course, currentModuleId, progress }: {
  course: StudentCourse;
  currentModuleId: string;
  progress: ModuleProgress[];
}) {
  const journey = buildCourseJourney(course.modules, progress);
  const href = (id: string) => `/cours/${encodeURIComponent(course.slug)}/modules/${encodeURIComponent(id)}`;

  return (
    <nav className="module-course-plan" aria-label="Plan du cours">
      <ol>
        {journey.modules.map((item, index) => {
          const active = item.module.id === currentModuleId;
          const available = item.state !== "locked";
          const label = (
            <>
              <span className="module-plan-marker" aria-hidden="true">
                {item.state === "complete" ? <Check size={15} /> : item.state === "locked" ? <LockKeyhole size={14} /> : index + 1}
              </span>
              <span className="module-plan-copy">
                <small>Module {index + 1}</small>
                <strong>{item.module.titre}</strong>
              </span>
              {active && <span className="module-plan-current">En lecture</span>}
            </>
          );
          return (
            <li className={`is-${item.state} ${active ? "is-active" : ""}`} key={item.module.id}>
              {available ? (
                <Link href={href(item.module.id)} aria-current={active ? "step" : undefined}>{label}</Link>
              ) : (
                <span aria-label={`Module ${index + 1} verrouillé`}>{label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CourseModuleNavigation({
  canGoNext,
  courseSlug,
  navigation
}: {
  canGoNext: boolean;
  courseSlug: string;
  navigation: {
    position: number;
    total: number;
    previousModule: CourseModule | null;
    nextModule: CourseModule | null;
  };
}) {
  const moduleHref = (id: string) => `/cours/${encodeURIComponent(courseSlug)}/modules/${encodeURIComponent(id)}`;

  return (
    <nav className="course-module-navigation" aria-label="Navigation entre les modules">
      {navigation.previousModule ? (
        <Link className="btn btn-outline" href={moduleHref(navigation.previousModule.id)}>
          <ArrowLeft size={17} aria-hidden="true" /> Précédent
        </Link>
      ) : (
        <span className="course-module-navigation-disabled" aria-disabled="true">
          <ArrowLeft size={17} aria-hidden="true" /> Précédent
        </span>
      )}
      <span className="course-module-position" aria-current="step">
        Module {navigation.position} sur {navigation.total}
      </span>
      {navigation.nextModule && canGoNext ? (
        <Link className="btn btn-outline" href={moduleHref(navigation.nextModule.id)}>
          Suivant <ArrowRight size={17} aria-hidden="true" />
        </Link>
      ) : (
        <span className="course-module-navigation-disabled" aria-disabled="true">
          {navigation.nextModule ? "Terminez pour continuer" : "Fin du cours"} <ArrowRight size={17} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

export default function ModulePage() {
  const params = useParams<{ slug: string; moduleId: string }>();
  const slug = String(params?.slug || "");
  const moduleId = String(params?.moduleId || "");
  const loginHref = `/auth/login?next=${encodeURIComponent(`/cours/${slug}/modules/${moduleId}`)}`;
  const [payload, setPayload] = useState<ModulePayload | null>(null);
  const [status, setStatus] = useState<ModuleStatus>("loading");
  const [error, setError] = useState("");
  const [lockedResumeId, setLockedResumeId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [startStatus, setStartStatus] = useState<ModuleStartStatus>("idle");
  const [startRetryKey, setStartRetryKey] = useState(0);
  const [completionAvailableAt, setCompletionAvailableAt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [completionDocuments, setCompletionDocuments] = useState(0);
  const [completionWarnings, setCompletionWarnings] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<ReaderPreferences>(defaultReaderPreferences);
  const [preferencesReady, setPreferencesReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadModule() {
      setStatus("loading");
      setError("");
      setLockedResumeId("");
      try {
        const supabase = createBrowserClient();
        if (!supabase) throw new Error("Le service est momentanément indisponible. Réessayez dans quelques instants.");

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          if (!mounted) return;
          setError(sessionError?.message || "Connectez-vous pour accéder à ce module.");
          setStatus("unauthenticated");
          return;
        }

        const response = await fetch(
          `/api/learning/courses/${encodeURIComponent(slug)}/modules/${encodeURIComponent(moduleId)}`,
          { cache: "no-store", credentials: "same-origin" },
        );
        const data = await response.json().catch(() => null);
        if (!mounted) return;

        if (!response.ok || data?.ok !== true) {
          setError(data?.error || "Le module n'a pas pu être chargé.");
          setLockedResumeId(String(data?.resumeModuleId || ""));
          setStatus(response.status === 401 ? "unauthenticated" : response.status === 409 ? "locked" : "error");
          return;
        }

        const courseWithModule = data.course ? {
          ...data.course,
          modules: Array.isArray(data.course.modules)
            ? data.course.modules.map((item: CourseModule) => item.id === data.module?.id ? { ...item, ...data.module } : item)
            : data.module ? [data.module] : [],
        } : null;
        setPayload({
          courses: courseWithModule ? [courseWithModule] : [],
          progress: data.progress || [],
        });
        setStatus("ready");
      } catch (cause) {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : "La connexion a été interrompue pendant le chargement.");
        setStatus("error");
      }
    }

    void loadModule();
    return () => {
      mounted = false;
    };
  }, [moduleId, reloadKey, slug]);

  useEffect(() => {
    setSaveError("");
    setCompletionAvailableAt(0);
    setClock(Date.now());
    setQuizAnswers({});
    setQuizScore(null);
    setStartStatus("idle");
    setCompletionDocuments(0);
    setCompletionWarnings([]);
  }, [moduleId]);

  useEffect(() => {
    try {
      setPreferences(parseReaderPreferences(window.localStorage.getItem("irenee:reader-preferences:v1")));
    } catch {
      setPreferences(defaultReaderPreferences);
    }
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    try {
      window.localStorage.setItem("irenee:reader-preferences:v1", JSON.stringify(preferences));
    } catch {
      // Reading preferences are a non-critical local convenience.
    }
  }, [preferences, preferencesReady]);

  const course = useMemo(() => payload?.courses.find(item => item.slug === slug), [payload, slug]);
  const module = useMemo(() => course?.modules.find(item => item.id === moduleId), [course, moduleId]);
  const progress = useMemo(() => payload?.progress.find(item => item.module_id === moduleId), [payload, moduleId]);
  const resources = module ? getResources(module) : [];
  const isComplete = Boolean(progress?.complete);
  const isQuiz = module?.type === "quiz" || module?.type_contenu === "quiz";
  const quizQuestions = isQuiz && Array.isArray(module?.quiz) ? module.quiz : [];
  const allQuizQuestionsAnswered = quizQuestions.length > 0 && quizQuestions.every((question, index) => {
    const id = String(question.id || `question-${index + 1}`);
    return Number.isInteger(quizAnswers[id]);
  });
  const engagementSecondsRemaining = Math.max(0, Math.ceil((completionAvailableAt - clock) / 1000));

  useEffect(() => {
    if (!course || !module) return;
    if (isComplete) {
      setStartStatus("ready");
      return;
    }
    let cancelled = false;

    async function startModule() {
      setStartStatus("pending");
      const response = await fetch("/api/progress/update", {
        body: JSON.stringify({ action: "start", course_id: course!.id, module_id: module!.id }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }).catch(() => null);
      const data = await response?.json().catch(() => null);
      if (cancelled) return;
      if (!response?.ok || data?.ok !== true) {
        setSaveError(data?.error || "Le début de votre lecture n'a pas pu être enregistré. Réessayez avant de terminer le module.");
        setStartStatus("error");
        return;
      }
      const startedAt = Date.parse(String(data.data?.date_debut || ""));
      setCompletionAvailableAt((Number.isFinite(startedAt) ? startedAt : Date.now()) + 30_000);
      setPayload(current => current ? {
        ...current,
        progress: [
          ...current.progress.filter(item => item.module_id !== module!.id),
          { ...data.data, course_id: course!.id, module_id: module!.id }
        ]
      } : current);
      setSaveError("");
      setStartStatus("ready");
    }

    startModule();
    return () => {
      cancelled = true;
    };
  }, [course, isComplete, module, startRetryKey]);

  useEffect(() => {
    if (!completionAvailableAt || completionAvailableAt <= Date.now()) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [completionAvailableAt]);

  async function markComplete() {
    if (!course || !module || saving) return;
    if (startStatus !== "ready") {
      setSaveError("La progression doit être initialisée avant de terminer ce module.");
      return;
    }
    if (isQuiz && !allQuizQuestionsAnswered) {
      setSaveError("Répondez à toutes les questions avant de valider le quiz.");
      return;
    }
    const supabase = createBrowserClient();
    if (!supabase) {
      setSaveError("Le service est momentanément indisponible. Votre lecture reste ouverte ; réessayez dans un instant.");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setSaveError("Votre connexion a expiré. Reconnectez-vous dans un autre onglet, puis réessayez sans perdre votre lecture.");
        return;
      }

      const response = await fetch("/api/progress/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(isQuiz ? { answers: quizAnswers } : {}),
          course_id: course.id,
          module_id: module.id,
          complete: true,
          progression: 100
        })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.ok !== true) {
        if (Number.isFinite(Number(data?.score))) setQuizScore(Number(data.score));
        setSaveError(data?.error || "Votre avancée n'a pas pu être enregistrée. Votre lecture reste disponible.");
        return;
      }

      setPayload(current => current ? {
        ...current,
        progress: [
          ...current.progress.filter(item => item.module_id !== module.id),
          { course_id: course.id, module_id: module.id, complete: true, progression: 100 }
        ]
      } : current);
      setCompletionDocuments(Array.isArray(data.documents) ? data.documents.length : 0);
      setCompletionWarnings(Array.isArray(data.warnings) ? data.warnings.map(String) : []);
    } catch {
      setSaveError("La connexion a été interrompue. Votre lecture reste disponible ; réessayez dans un instant.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <section className="section course-state-page">
        <div className="container center">
          <div className="course-state-card" role="status" aria-live="polite" aria-busy="true">
            <Loader2 className="action-spin" size={34} aria-hidden="true" />
            <h1>Préparation du module</h1>
            <p>Nous vérifions votre progression et préparons un espace de lecture confortable.</p>
          </div>
        </div>
      </section>
    );
  }

  if (status === "unauthenticated" || status === "error" || status === "locked") {
    const locked = status === "locked";
    return (
      <section className="section course-state-page">
        <div className="container center">
          <div className="course-state-card">
            {locked ? <LockKeyhole size={38} aria-hidden="true" /> : <AlertTriangle size={38} aria-hidden="true" />}
            <h1>{status === "unauthenticated" ? "Connexion requise" : locked ? "Module verrouillé" : "Module indisponible"}</h1>
            <p>{error}</p>
            <div className="course-state-actions">
              {status === "unauthenticated" ? (
                <Link href={loginHref} className="btn btn-primary">Se connecter</Link>
              ) : locked && lockedResumeId ? (
                <Link className="btn btn-primary" href={`/cours/${encodeURIComponent(slug)}/modules/${encodeURIComponent(lockedResumeId)}`}>
                  Reprendre le bon module <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : (
                <button className="btn btn-primary" type="button" onClick={() => setReloadKey(value => value + 1)}>
                  <RotateCcw size={17} aria-hidden="true" /> Réessayer
                </button>
              )}
              <Link href={`/cours/${encodeURIComponent(slug)}`} className="btn btn-outline">Retour au cours</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!course || !module) {
    return (
      <section className="section course-state-page">
        <div className="container center">
          <div className="course-state-card">
            <AlertTriangle size={38} aria-hidden="true" />
            <h1>Module non accessible</h1>
            <p>Ce module n'est pas encore disponible sur votre compte.</p>
            <Link href={`/cours/${encodeURIComponent(slug)}`} className="btn btn-primary">Retour au cours</Link>
          </div>
        </div>
      </section>
    );
  }

  const navigation = getModuleNavigation(course.modules, module.id);
  const safeVideoUrl = getSafeCourseAssetUrl(module.url_video);
  const expectsVideo = module.type === "video" || module.type_contenu === "video" || Boolean(module.url_video);
  const answeredQuizQuestions = quizQuestions.filter((question, index) => {
    const id = String(question.id || `question-${index + 1}`);
    return Number.isInteger(quizAnswers[id]);
  }).length;

  return (
    <section className="section course-reader-page module-workspace-page">
      <div className="container module-workspace-container">
        <Link className="course-back-link" href={`/cours/${course.slug}`}>← Vue d'ensemble du cours</Link>

        <details className="module-mobile-plan">
          <summary>
            <span><BookOpen size={18} aria-hidden="true" /> Plan du cours · Module {navigation.position}/{navigation.total}</span>
            <ChevronDown size={19} aria-hidden="true" />
          </summary>
          <CoursePlan course={course} currentModuleId={module.id} progress={payload?.progress || []} />
        </details>

        <div className="module-workspace-grid">
          <aside className="module-plan-sidebar">
            <div className="module-plan-sidebar-head">
              <span className="course-eyebrow">{course.titre}</span>
              <h2>Plan du cours</h2>
              <p>{navigation.total} modules · progression séquentielle</p>
            </div>
            <CoursePlan course={course} currentModuleId={module.id} progress={payload?.progress || []} />
            <Link href={`/cours/${course.slug}`} className="module-plan-overview-link">Voir la progression globale</Link>
          </aside>

          <section
            className="module-reading-workspace"
            data-font-scale={preferences.fontScale}
            data-measure={preferences.measure}
            aria-label={`Module ${navigation.position} : ${module.titre}`}
          >
            <header className="module-focus-header">
              <div className="module-focus-meta">
                <span className="badge">Module {navigation.position} sur {navigation.total}</span>
                <span>{module.duree || 0} min</span>
                <span>{module.type || module.type_contenu || "texte"}</span>
              </div>
              <h1>{module.titre}</h1>
              {module.description && <p>{module.description}</p>}
            </header>

            <section className="reader-preferences" aria-labelledby="reader-preferences-title">
              <div className="reader-preferences-title">
                <Settings2 size={18} aria-hidden="true" />
                <div><h2 id="reader-preferences-title">Confort de lecture</h2><p>Adaptez le texte à votre écran.</p></div>
              </div>
              <div className="reader-preference-actions">
                <div className="reader-font-controls" role="group" aria-label="Taille du texte">
                  <button className={preferences.fontScale === "small" ? "active" : ""} type="button" disabled={!preferencesReady} onClick={() => setPreferences(current => ({ ...current, fontScale: "small" }))} aria-label="Réduire la taille du texte" aria-pressed={preferences.fontScale === "small"}><Minus size={17} aria-hidden="true" /> A</button>
                  <button className={preferences.fontScale === "normal" ? "active" : ""} type="button" disabled={!preferencesReady} onClick={() => setPreferences(current => ({ ...current, fontScale: "normal" }))} aria-label="Taille de texte normale" aria-pressed={preferences.fontScale === "normal"}>A</button>
                  <button className={preferences.fontScale === "large" ? "active" : ""} type="button" disabled={!preferencesReady} onClick={() => setPreferences(current => ({ ...current, fontScale: "large" }))} aria-label="Augmenter la taille du texte" aria-pressed={preferences.fontScale === "large"}>A <Plus size={17} aria-hidden="true" /></button>
                </div>
                <button
                  className="reader-measure-toggle"
                  type="button"
                  disabled={!preferencesReady}
                  aria-label={preferences.measure === "focused" ? "Utiliser une colonne confortable" : "Utiliser une colonne focalisée"}
                  aria-pressed={preferences.measure === "focused"}
                  onClick={() => setPreferences(current => ({ ...current, measure: current.measure === "focused" ? "comfortable" : "focused" }))}
                >
                  <BookOpen size={16} aria-hidden="true" />
                  <span className="reader-measure-label">{preferences.measure === "focused" ? "Colonne focalisée" : "Colonne confortable"}</span>
                </button>
              </div>
            </section>

            {startStatus === "error" && (
              <div className="module-start-notice" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{saveError}</span>
                <button type="button" onClick={() => setStartRetryKey(value => value + 1)}>Réessayer l'enregistrement</button>
              </div>
            )}

            {safeVideoUrl ? (
              <AccessibleModuleVideo module={module} url={safeVideoUrl} />
            ) : expectsVideo ? (
              <div className="module-video-unavailable" role="status">
                <Film size={22} aria-hidden="true" />
                <div><h2>Vidéo temporairement indisponible</h2><p>Le contenu textuel du module reste accessible ci-dessous.</p></div>
              </div>
            ) : null}

            <article className="card module-reading-card" aria-label={`Lecture : ${module.titre}`}>
              {module.contenu_html ? (
                <ModuleHtmlContent html={module.contenu_html} preferences={preferences} title={module.titre} />
              ) : module.contenu ? (
                <section className="module-text-content"><h2>Contenu du module</h2><p>{module.contenu}</p></section>
              ) : (
                <section className="module-empty-content" role="status"><h2>Contenu du module</h2><p>Aucun contenu textuel n'est encore publié pour ce module.</p></section>
              )}
            </article>

            {resources.length > 0 && (
              <section className="card course-resource-card">
                <h2>Ressources utiles</h2>
                <div className="module-resource-list">
                  {resources.map(resource => (
                    <a className="btn btn-outline" href={resource.url} key={resource.url} target="_blank" rel="noopener noreferrer">
                      <span>{resource.label}</span> <ExternalLink size={15} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {isQuiz && (
              <section className="card course-resource-card course-quiz-card">
                <div className="module-quiz-heading">
                  <div><span className="course-eyebrow">Validation</span><h2>Quiz du module</h2></div>
                  {quizQuestions.length > 0 && <span>{answeredQuizQuestions}/{quizQuestions.length} réponses · 80 % requis</span>}
                </div>
                {quizQuestions.length ? quizQuestions.map((question, index) => (
                  <fieldset className="soft-card course-quiz-question" key={`${question.question}-${index}`}>
                    <legend>{index + 1}. {question.question}</legend>
                    <div className="course-quiz-options">
                      {question.options.map((option, optionIndex) => {
                        const questionId = String(question.id || `question-${index + 1}`);
                        return (
                          <label className="course-quiz-option" key={`${questionId}-${optionIndex}`}>
                            <input
                              checked={quizAnswers[questionId] === optionIndex}
                              name={`quiz-${questionId}`}
                              onChange={() => {
                                setQuizAnswers(current => ({ ...current, [questionId]: optionIndex }));
                                setQuizScore(null);
                                setSaveError("");
                              }}
                              type="radio"
                              value={optionIndex}
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                )) : (
                  <div className="module-config-warning" role="alert"><AlertTriangle size={18} aria-hidden="true" /> Ce quiz n'est pas encore correctement configuré. Contactez l'équipe pédagogique.</div>
                )}
                {quizScore !== null && <p className="course-quiz-score" role="status">Dernier score : <strong>{quizScore} %</strong></p>}
              </section>
            )}

            <section className="card course-complete-card" aria-busy={saving}>
              {saveError && startStatus !== "error" && (
                <div className="course-save-error" role="alert">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>{saveError}</span>
                  {saveError.includes("connexion a expiré") && <Link href={loginHref}>Se reconnecter</Link>}
                </div>
              )}
              {isComplete ? (
                <div className="module-complete-success">
                  <CheckCircle2 size={28} aria-hidden="true" />
                  <div>
                    <h2>Module terminé</h2>
                    <p role="status" aria-live="polite">Votre progression est enregistrée.</p>
                    {completionDocuments > 0 && <p>Votre nouveau parchemin est disponible dans l'espace étudiant.</p>}
                    {completionWarnings.map(warning => <p className="module-completion-warning" key={warning}>{warning}</p>)}
                  </div>
                  {navigation.nextModule ? (
                    <Link className="btn btn-primary" href={`/cours/${encodeURIComponent(course.slug)}/modules/${encodeURIComponent(navigation.nextModule.id)}`}>
                      Continuer le parcours <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  ) : (
                    <Link className="btn btn-primary" href={`/cours/${encodeURIComponent(course.slug)}`}>Voir mon parcours terminé</Link>
                  )}
                </div>
              ) : (
                <div className="module-complete-action">
                  <div>
                    <span className="course-eyebrow">Votre progression</span>
                    <h2>{isQuiz ? "Prêt à valider vos réponses ?" : "Vous avez terminé votre lecture ?"}</h2>
                    <p>{startStatus === "pending" ? "Initialisation de votre progression…" : isQuiz ? "Le module sera validé à partir de 80 %." : "Cette action débloquera le module suivant."}</p>
                  </div>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={markComplete}
                    disabled={saving || startStatus !== "ready" || engagementSecondsRemaining > 0 || (isQuiz && !allQuizQuestionsAnswered)}
                  >
                    {(saving || startStatus === "pending") && <Loader2 className="action-spin" size={18} aria-hidden="true" />}
                    {saving
                      ? "Enregistrement..."
                      : startStatus === "pending"
                        ? "Préparation…"
                        : engagementSecondsRemaining > 0
                          ? `Disponible dans ${engagementSecondsRemaining} s`
                          : isQuiz ? "Valider le quiz" : "Marquer comme terminé"}
                  </button>
                </div>
              )}
            </section>

            <CourseModuleNavigation canGoNext={isComplete} courseSlug={course.slug} navigation={navigation} />
          </section>
        </div>
      </div>
    </section>
  );
}
