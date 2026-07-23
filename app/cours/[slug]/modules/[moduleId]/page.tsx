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
  Eye,
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
import { getModuleNavigation, getSafeCourseAssetUrl, getSafeCourseMediaUrl } from "@/components/course-reader-utils";
import {
  buildCourseJourney,
  defaultReaderPreferences,
  parseReaderPreferences,
  type ReaderPreferences,
} from "@/lib/course-experience";
import {
  sanitizeCourseClassAttribute,
  sanitizeCourseStyleAttribute,
  stripAuthoredStyleBlocksBeforeParsing,
} from "@/lib/course-html-style";
import { createBrowserClient } from "@/lib/supabase";
import type { Course, CourseModule, ModuleProgress, Profile } from "@/lib/types";

type StudentCourse = Course & {
  progress?: number;
  completedModules?: number;
};

type NextCourse = {
  slug: string;
  titre: string;
};

type ModulePayload = {
  accessMode?: "learning" | "preview";
  courses: StudentCourse[];
  nextCourse: NextCourse | null;
  profile: Profile;
  progress: ModuleProgress[];
};

type ModuleStatus = "loading" | "ready" | "locked" | "unauthenticated" | "error";
type ModuleStartStatus = "idle" | "pending" | "ready" | "error";

type Resource = {
  label: string;
  url: string;
};

const MODULE_CONTENT_RESIZED_EVENT = "irenee:module-content-resized";
const MODULE_READER_INTERACTION_EVENT = "irenee:module-reader-interaction";
const CSP_NONCE_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/;

function getDocumentStyleNonce() {
  if (typeof document === "undefined") return "";
  const nonce = document.querySelector<HTMLElement>("script[nonce], style[nonce]")?.nonce || "";
  return CSP_NONCE_PATTERN.test(nonce) ? nonce : "";
}

const moduleFrameThemeCss = `
  html { background: #fffaf0; }
  body {
    color: #172033;
    background: #fffaf0;
    font-family: Charter, "Bitstream Charter", "Iowan Old Style", Georgia, serif;
    font-size: 18px;
    line-height: 1.76;
    padding: 38px clamp(26px, 6vw, 72px) 54px;
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
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.18;
    overflow-wrap: anywhere;
  }
  p, li, blockquote, td, th, span, strong, em {
    color: #172033 !important;
  }
  .module-content a,
  .module-content a * {
    color: #7a1717 !important;
    font-weight: 800 !important;
    text-decoration: underline !important;
    text-decoration-thickness: .09em !important;
    text-underline-offset: .16em !important;
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
    margin: 1.45rem 0;
    padding: 16px 18px;
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
  .module-content .course-callout,
  .module-content .course-block,
  .module-content .course-quote {
    margin: 1.7rem 0;
    padding: 18px 20px;
    color: #172033 !important;
    border-radius: 12px;
  }
  .module-content .course-callout {
    border-left: 5px solid #2f67a7;
    background: #eef5fc;
  }
  .module-content .course-callout-warning {
    border-left-color: #b7791f;
    background: #fff4d8;
  }
  .module-content .course-block {
    border: 1px solid #dfd3ba;
    background: #fffdf8;
  }
  .module-content .course-quote {
    border-left: 5px solid #7a1717;
    background: #f7f1e8;
    font-size: 1.08em;
    font-style: italic;
  }
  .module-content :is(.course-callout, .course-block, .course-quote) > :first-child { margin-top: 0; }
  .module-content :is(.course-callout, .course-block, .course-quote) > :last-child { margin-bottom: 0; }
  @media (max-width: 640px) {
    body {
      font-size: 17px;
      line-height: 1.68;
      padding: 24px 20px 32px;
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
      display: grid !important;
      grid-template-columns: minmax(76px, .62fr) minmax(0, 1fr) !important;
      gap: 8px !important;
      align-items: start !important;
      padding: 11px 10px !important;
      border: 0 !important;
      border-top: 1px solid #eadbb7 !important;
      background: transparent !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }
    .module-responsive-table td:first-child {
      border-top: 0 !important;
    }
    .module-responsive-table td::before {
      content: attr(data-label);
      display: block;
      margin: 0;
      color: #071d49;
      font-weight: 800;
      font-style: normal;
    }
  }
`;

function sanitizeModuleHtml(html: string) {
  const document = new DOMParser().parseFromString(DOMPurify.sanitize(stripAuthoredStyleBlocksBeforeParsing(html), {
    FORBID_TAGS: [
      "audio", "base", "button", "embed", "form", "iframe", "input", "link", "math", "meta", "object",
      "option", "script", "select", "source", "style", "svg", "textarea", "track", "video",
    ],
  }), "text/html");
  document.querySelectorAll<HTMLElement>("[style]").forEach(element => {
    const safeStyle = sanitizeCourseStyleAttribute(element.getAttribute("style") || "");
    if (safeStyle) element.setAttribute("style", safeStyle);
    else element.removeAttribute("style");
  });
  document.querySelectorAll<HTMLElement>("[class]").forEach(element => {
    const safeClass = sanitizeCourseClassAttribute(element.getAttribute("class") || "");
    if (safeClass) element.setAttribute("class", safeClass);
    else element.removeAttribute("class");
  });
  document.querySelectorAll<HTMLElement>(".comparison-table:not(table)").forEach(element => {
    element.classList.remove("comparison-table");
  });
  document.querySelectorAll<HTMLImageElement>("img").forEach(image => {
    if (!image.hasAttribute("alt")) image.alt = image.title.trim() || "Illustration du cours";
    image.loading = "lazy";
  });
  document.querySelectorAll<HTMLAnchorElement>("a").forEach(anchor => {
    const href = anchor.getAttribute("href") || "";
    const safeHref = getSafeCourseLinkUrl(href);
    if (safeHref) anchor.setAttribute("href", safeHref);
    else anchor.removeAttribute("href");
    anchor.removeAttribute("target");
    anchor.setAttribute("rel", "noopener noreferrer");
    anchor.dataset.readerLink = "true";
    const accessibleName = anchor.textContent?.trim() || anchor.querySelector("img")?.getAttribute("alt")?.trim() || "";
    if (!accessibleName) anchor.setAttribute("aria-label", anchor.title.trim() || "Ressource du cours");
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

function getSafeCourseLinkUrl(value: string) {
  const candidate = value.trim();
  if (!candidate || candidate.length > 2_048 || /[\u0000-\u001f\u007f\\]/.test(candidate) || candidate.startsWith("//")) return "";
  try {
    const decoded = decodeURIComponent(candidate);
    if (/[\u0000-\u001f\u007f\\]/.test(decoded) || decoded.startsWith("//")) return "";
  } catch {
    return "";
  }
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  if (/^(?:mailto:|tel:)/i.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch {
    return "";
  }
}

function ModuleHtmlContent({ html, preferences, title }: { html: string; preferences: ReaderPreferences; title: string }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const frameCleanupRef = useRef<() => void>(() => undefined);
  const styleNonce = useMemo(getDocumentStyleNonce, []);
  const srcDocument = useMemo(() => {
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
    <style nonce="${styleNonce}">html,body{margin:0;padding:0}body{overflow-wrap:anywhere}table{max-width:100%}</style>
    <style nonce="${styleNonce}">${moduleFrameThemeCss}</style>
    <style nonce="${styleNonce}">${preferenceCss}</style>
  </head>
  <body><main class="module-content">${sanitizedHtml}</main></body>
</html>`;
  }, [html, preferences, styleNonce]);

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
    window.dispatchEvent(new Event(MODULE_CONTENT_RESIZED_EVENT));
  }, []);

  const bindFrameDocument = useCallback(() => {
    frameCleanupRef.current();
    frameCleanupRef.current = () => undefined;
    const frame = frameRef.current;
    if (!frame) return;
    const doc = frame.contentDocument;
    if (!doc?.body || !doc.documentElement) return;
    const observer = new ResizeObserver(syncHeight);
    let active = true;
    const onDocumentClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[data-reader-link='true']") as HTMLAnchorElement | null;
      if (!anchor) return;
      event.preventDefault();
      const safeHref = getSafeCourseLinkUrl(anchor.getAttribute("href") || "");
      if (!safeHref) return;
      const destination = safeHref.startsWith("/") ? new URL(safeHref, window.location.origin).toString() : safeHref;
      window.open(destination, "_blank", "noopener,noreferrer");
    };
    const notifyReaderInteraction = () => window.dispatchEvent(new Event(MODULE_READER_INTERACTION_EVENT));
    observer.observe(doc.body);
    observer.observe(doc.documentElement);
    const pendingImages = Array.from(doc.querySelectorAll("img")).filter(image => !image.complete);
    pendingImages.forEach(image => {
      if (!image.complete) image.addEventListener("load", syncHeight, { once: true });
    });
    doc.fonts?.ready.then(() => { if (active) syncHeight(); }).catch(() => undefined);
    doc.addEventListener("click", onDocumentClick);
    doc.addEventListener("keydown", notifyReaderInteraction);
    doc.addEventListener("pointerdown", notifyReaderInteraction, { passive: true });
    doc.addEventListener("touchstart", notifyReaderInteraction, { passive: true });
    doc.addEventListener("wheel", notifyReaderInteraction, { passive: true });
    const delayedSync = window.setTimeout(syncHeight, 300);
    window.addEventListener("resize", syncHeight);
    syncHeight();
    frameCleanupRef.current = () => {
      active = false;
      window.clearTimeout(delayedSync);
      observer.disconnect();
      pendingImages.forEach(image => image.removeEventListener("load", syncHeight));
      doc.removeEventListener("click", onDocumentClick);
      doc.removeEventListener("keydown", notifyReaderInteraction);
      doc.removeEventListener("pointerdown", notifyReaderInteraction);
      doc.removeEventListener("touchstart", notifyReaderInteraction);
      doc.removeEventListener("wheel", notifyReaderInteraction);
      window.removeEventListener("resize", syncHeight);
    };
  }, [syncHeight]);

  useEffect(() => {
    bindFrameDocument();
    return () => frameCleanupRef.current();
  }, [bindFrameDocument, srcDocument]);

  return (
    <iframe
      ref={frameRef}
      className="module-html-frame"
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      srcDoc={srcDocument}
      title={`Contenu du module : ${title}`}
      onLoad={bindFrameDocument}
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

function AccessibleModuleVideo({ module, url, captionsUrl }: { module: CourseModule; url: string; captionsUrl: string }) {
  const summaryId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [captionsStatus, setCaptionsStatus] = useState<"loading" | "ready" | "error">("loading");
  const textAlternative = module.contenu?.trim()
    || module.description?.trim()
    || "Aucun résumé textuel n'est encore disponible pour cette vidéo.";

  useEffect(() => setCaptionsStatus("loading"), [captionsUrl]);

  useEffect(() => {
    if (captionsStatus === "error") {
      videoRef.current?.pause();
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }, [captionsStatus]);

  return (
    <section className="card module-video-section" aria-labelledby={`${summaryId}-title`}>
      <div className="module-video-heading">
        <Film size={22} aria-hidden="true" />
        <h2 id={`${summaryId}-title`}>Vidéo du module</h2>
      </div>
      {captionsStatus !== "error" && (
      <video
        ref={videoRef}
        className="module-video-player"
        controls={captionsStatus === "ready"}
        crossOrigin="anonymous"
        playsInline
        preload="metadata"
        aria-busy={captionsStatus === "loading"}
        aria-label={`Vidéo : ${module.titre}`}
        aria-describedby={summaryId}
      >
        <source src={url} />
        <track
          default
          kind="captions"
          src={captionsUrl}
          srcLang="fr"
          label="Français"
          onLoad={() => setCaptionsStatus("ready")}
          onError={() => setCaptionsStatus("error")}
        />
        Votre navigateur ne peut pas lire cette vidéo.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer">Ouvrir la vidéo dans un nouvel onglet</a>.
      </video>
      )}
      {captionsStatus === "error" && (
        <div className="module-video-caption-error" role="alert">
          La vidéo a été désactivée car ses sous-titres ne sont plus disponibles. Le contenu textuel reste accessible ci-dessous.
        </div>
      )}
      <details className="module-video-transcript">
        <summary>Résumé textuel de la vidéo</summary>
        <p id={summaryId}>{textAlternative}</p>
        {module.contenu_html && <p>Le contenu textuel détaillé est disponible juste sous la vidéo.</p>}
      </details>
    </section>
  );
}

function CoursePlan({ course, currentModuleId, progress, unlockAll = false }: {
  course: StudentCourse;
  currentModuleId: string;
  progress: ModuleProgress[];
  unlockAll?: boolean;
}) {
  const journey = buildCourseJourney(course.modules, progress, { unlockAll });
  const href = (id: string) => `/cours/${encodeURIComponent(course.slug)}/modules/${encodeURIComponent(id)}`;
  const planRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const plan = planRef.current;
    if (!plan) return;
    const details = plan.closest("details");
    const revealActiveModule = () => {
      if (details && !details.open) return;
      const active = plan.querySelector<HTMLElement>(".is-active");
      if (!active || plan.scrollHeight <= plan.clientHeight) return;
      plan.scrollTop = Math.max(0, active.offsetTop - Math.max(0, (plan.clientHeight - active.offsetHeight) / 2));
    };
    const timer = window.setTimeout(revealActiveModule, 0);
    details?.addEventListener("toggle", revealActiveModule);
    return () => {
      window.clearTimeout(timer);
      details?.removeEventListener("toggle", revealActiveModule);
    };
  }, [currentModuleId]);

  return (
    <nav ref={planRef} className="module-course-plan" aria-label="Plan du cours">
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
      <span className="course-module-position" aria-current="step">
        Module {navigation.position} sur {navigation.total}
      </span>
      <div className="course-module-navigation-actions">
        {navigation.previousModule && (
          <Link className="btn btn-outline" href={moduleHref(navigation.previousModule.id)}>
            <ArrowLeft size={17} aria-hidden="true" /> Précédent
          </Link>
        )}
        {navigation.nextModule && canGoNext ? (
          <Link className="btn btn-primary" href={moduleHref(navigation.nextModule.id)}>
            Module suivant <ArrowRight size={17} aria-hidden="true" />
          </Link>
        ) : (
          <span className="course-module-navigation-status">
            {navigation.nextModule ? "Le module suivant se débloque après validation." : "Vous êtes au dernier module."}
          </span>
        )}
      </div>
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
  const [quizFeedback, setQuizFeedback] = useState("");
  const [completionDocuments, setCompletionDocuments] = useState(0);
  const [completionWarnings, setCompletionWarnings] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<ReaderPreferences>(defaultReaderPreferences);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const readingAnchorRef = useRef<HTMLDivElement | null>(null);

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
          accessMode: data.accessMode === "preview" ? "preview" : "learning",
          courses: courseWithModule ? [courseWithModule] : [],
          nextCourse: data.nextCourse && typeof data.nextCourse.slug === "string"
            ? { slug: String(data.nextCourse.slug), titre: String(data.nextCourse.titre || "Cours suivant") }
            : null,
          profile: data.profile,
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
    setQuizFeedback("");
    setReadingProgress(0);
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
  const readerProfileId = String(payload?.profile?.id || "");
  const progress = useMemo(() => payload?.progress.find(item => item.module_id === moduleId), [payload, moduleId]);
  const resources = module ? getResources(module) : [];
  const isComplete = Boolean(progress?.complete);
  const isStaffPreview = payload?.accessMode === "preview";
  const quizQuestions = Array.isArray(module?.quiz) ? module.quiz : [];
  // A module gates completion on its quiz as soon as it carries questions,
  // whatever its primary content type (a reading can end with an evaluation).
  const isQuiz = quizQuestions.length > 0;
  const allQuizQuestionsAnswered = quizQuestions.length > 0 && quizQuestions.every((question, index) => {
    const id = String(question.id || `question-${index + 1}`);
    return Number.isInteger(quizAnswers[id]);
  });
  const engagementSecondsRemaining = Math.max(0, Math.ceil((completionAvailableAt - clock) / 1000));

  useEffect(() => {
    if (status !== "ready" || !module || !readerProfileId) return;
    const storageKey = `irenee:reader-position:v1:${readerProfileId}:${slug}:${module.id}`;
    let animationFrame = 0;
    let lastSavedAt = 0;
    let userInteracted = false;
    const restoreDeadline = Date.now() + 5_000;
    let restoreTarget = 0;
    try {
      const stored = Number(window.localStorage.getItem(storageKey));
      restoreTarget = Number.isFinite(stored) && stored > 0 ? stored : 0;
    } catch {
      restoreTarget = 0;
    }

    const updateReadingProgress = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const anchor = readingAnchorRef.current;
        if (!anchor) return;
        const top = window.scrollY + anchor.getBoundingClientRect().top;
        const distance = Math.max(1, anchor.scrollHeight - window.innerHeight * .55);
        const value = Math.max(0, Math.min(100, Math.round(((window.scrollY - top) / distance) * 100)));
        setReadingProgress(current => current === value ? current : value);
      });
    };
    const savePosition = (force = false) => {
      const now = Date.now();
      if (!force && now - lastSavedAt < 400) return;
      lastSavedAt = now;
      try {
        window.localStorage.setItem(storageKey, String(Math.max(0, Math.round(window.scrollY))));
      } catch {
        // Position restoration is a non-critical local convenience.
      }
    };
    const onScroll = () => {
      updateReadingProgress();
      if (userInteracted) savePosition();
    };
    const markUserInteraction = () => { userInteracted = true; };
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "].includes(event.key)) markUserInteraction();
    };
    const onPageHide = () => {
      if (userInteracted) savePosition(true);
    };
    const restorePosition = () => {
      if (!restoreTarget || userInteracted || Date.now() > restoreDeadline) return;
      try {
        const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const root = document.documentElement;
        const previousScrollBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo({ top: Math.min(restoreTarget, maximum), behavior: "auto" });
        root.style.scrollBehavior = previousScrollBehavior;
      } catch {
        // Ignore malformed or unavailable local storage.
      }
      updateReadingProgress();
    };

    const firstRestore = window.setTimeout(restorePosition, 120);
    const settledRestore = window.setTimeout(restorePosition, 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateReadingProgress);
    window.addEventListener(MODULE_CONTENT_RESIZED_EVENT, restorePosition);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", markUserInteraction, { passive: true });
    window.addEventListener("touchstart", markUserInteraction, { passive: true });
    window.addEventListener("wheel", markUserInteraction, { passive: true });
    window.addEventListener(MODULE_READER_INTERACTION_EVENT, markUserInteraction);
    window.addEventListener("pagehide", onPageHide);
    updateReadingProgress();
    return () => {
      window.clearTimeout(firstRestore);
      window.clearTimeout(settledRestore);
      window.cancelAnimationFrame(animationFrame);
      if (userInteracted) savePosition(true);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateReadingProgress);
      window.removeEventListener(MODULE_CONTENT_RESIZED_EVENT, restorePosition);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", markUserInteraction);
      window.removeEventListener("touchstart", markUserInteraction);
      window.removeEventListener("wheel", markUserInteraction);
      window.removeEventListener(MODULE_READER_INTERACTION_EVENT, markUserInteraction);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [module, readerProfileId, slug, status]);

  useEffect(() => {
    if (!course || !module) return;
    if (isStaffPreview) {
      setStartStatus("ready");
      return;
    }
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
  }, [course, isComplete, isStaffPreview, module, startRetryKey]);

  useEffect(() => {
    if (!completionAvailableAt || completionAvailableAt <= Date.now()) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [completionAvailableAt]);

  async function markComplete() {
    if (!course || !module || saving) return;
    if (isStaffPreview) return;
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
    setQuizFeedback("");
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
        if (isQuiz && response.status === 422 && Number.isFinite(Number(data?.score))) {
          setQuizScore(Number(data.score));
          setQuizFeedback(data?.error || "Le score requis n'est pas encore atteint. Vous pouvez modifier vos réponses et réessayer.");
          return;
        }
        setSaveError(data?.error || "Votre avancée n'a pas pu être enregistrée. Votre lecture reste disponible.");
        return;
      }

      if (isQuiz && Number.isFinite(Number(data?.data?.score_quiz))) {
        setQuizScore(Number(data.data.score_quiz));
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
  const nextCourse = payload?.nextCourse || null;
  const courseHref = (courseSlug: string) => `/cours/${encodeURIComponent(courseSlug)}`;
  const safeVideoUrl = getSafeCourseMediaUrl(module.url_video);
  const safeCaptionsUrl = getSafeCourseMediaUrl(module.url_sous_titres);
  const expectsVideo = module.type === "video" || module.type_contenu === "video" || Boolean(module.url_video);
  const answeredQuizQuestions = quizQuestions.filter((question, index) => {
    const id = String(question.id || `question-${index + 1}`);
    return Number.isInteger(quizAnswers[id]);
  }).length;
  const completedModuleCount = (payload?.progress || []).filter(item => item.complete === true).length;
  const moduleKind = module.type === "video" || module.type_contenu === "video"
    ? "Vidéo"
    : module.type === "quiz" || module.type_contenu === "quiz"
      ? "Quiz"
      : "Lecture";

  return (
    <section className="section course-reader-page module-workspace-page">
      <div className="container module-workspace-container">
        <header className="module-session-bar">
          <Link className="module-session-back" href={`/cours/${course.slug}`}>
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Vue d’ensemble</span>
          </Link>
          <div
            className="module-session-progress"
            role="progressbar"
            aria-label="Progression de lecture"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={readingProgress}
          >
            <span>Module {navigation.position}/{navigation.total}</span>
            <span className="module-session-progress-track" aria-hidden="true">
              <span style={{ width: `${readingProgress}%` }} />
            </span>
            <strong>{readingProgress} % lu</strong>
          </div>
        </header>

        <details className="module-mobile-plan">
          <summary aria-label="Ouvrir ou fermer le plan du cours">
            <span><BookOpen size={18} aria-hidden="true" /><span className="module-mobile-plan-label">Plan<span className="module-mobile-plan-label-long"> du cours</span></span></span>
            <small>{isStaffPreview ? "Aperçu libre" : `${completedModuleCount}/${navigation.total} terminés`}</small>
            <ChevronDown size={19} aria-hidden="true" />
          </summary>
          <CoursePlan course={course} currentModuleId={module.id} progress={payload?.progress || []} unlockAll={isStaffPreview} />
        </details>

        <div className="module-workspace-grid">
          <aside className="module-plan-sidebar">
            <div className="module-plan-sidebar-head">
              <span className="course-eyebrow">{course.titre}</span>
              <h2>Plan du cours</h2>
              <p>{navigation.total} modules · {isStaffPreview ? "prévisualisation libre" : `${completedModuleCount} terminé${completedModuleCount > 1 ? "s" : ""}`}</p>
              <div
                className="module-plan-progress"
                role="progressbar"
                aria-label="Progression dans le cours"
                aria-valuemin={0}
                aria-valuemax={navigation.total}
                aria-valuenow={isStaffPreview ? navigation.total : completedModuleCount}
              >
                <span style={{ width: `${isStaffPreview ? 100 : navigation.total ? (completedModuleCount / navigation.total) * 100 : 0}%` }} />
              </div>
            </div>
            <CoursePlan course={course} currentModuleId={module.id} progress={payload?.progress || []} unlockAll={isStaffPreview} />
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
                <span className="badge">Module {navigation.position}</span>
                <span>{module.duree || 0} min</span>
                <span>{moduleKind}</span>
              </div>
              <h1>{module.titre}</h1>
              {module.description && <p>{module.description}</p>}
            </header>

            {isStaffPreview && (
              <div className="module-preview-notice" role="status">
                <Eye size={19} aria-hidden="true" />
                <div><strong>Mode aperçu équipe</strong><span>Tous les modules sont accessibles. Aucune progression ni attestation ne sera créée.</span></div>
              </div>
            )}

            <details className="reader-preferences">
              <summary aria-label="Réglages de lecture">
                <span className="reader-preferences-title">
                  <Settings2 size={18} aria-hidden="true" />
                  <span><strong>Réglages de lecture</strong><small>Taille et largeur du texte</small></span>
                </span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
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
            </details>

            {startStatus === "error" && (
              <div className="module-start-notice" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{saveError}</span>
                <button type="button" onClick={() => setStartRetryKey(value => value + 1)}>Réessayer l'enregistrement</button>
              </div>
            )}

            <div ref={readingAnchorRef} className="module-reading-anchor">
              {safeVideoUrl && safeCaptionsUrl ? (
                <AccessibleModuleVideo module={module} url={safeVideoUrl} captionsUrl={safeCaptionsUrl} />
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
            </div>

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
                                setQuizFeedback("");
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
                {quizScore !== null && (
                  <div className={`course-quiz-feedback ${quizScore >= 80 ? "is-success" : "is-retry"}`} role="status">
                    <div>
                      <strong>{quizScore >= 80 ? "Quiz réussi" : "Continuez, vous y êtes presque"}</strong>
                      <span>{quizFeedback || `Dernier score : ${quizScore} %`}</span>
                    </div>
                    {quizScore < 80 && (
                      <button type="button" className="btn btn-outline" onClick={() => {
                        setQuizAnswers({});
                        setQuizScore(null);
                        setQuizFeedback("");
                      }}>Recommencer</button>
                    )}
                  </div>
                )}
              </section>
            )}

            {isStaffPreview ? (
              <section className="module-preview-complete" aria-label="Fin de la prévisualisation">
                <div>
                  <span className="course-eyebrow">Aperçu terminé</span>
                  <h2>Relire ou poursuivre le contrôle du cours</h2>
                  <p>Cette consultation n’a modifié aucune progression étudiante.</p>
                </div>
                {navigation.nextModule ? (
                  <Link className="btn btn-primary" href={`/cours/${encodeURIComponent(course.slug)}/modules/${encodeURIComponent(navigation.nextModule.id)}`}>
                    Prévisualiser le module suivant <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                ) : nextCourse ? (
                  <Link className="btn btn-primary" href={courseHref(nextCourse.slug)}>
                    Prévisualiser le cours suivant <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                ) : (
                  <Link className="btn btn-outline" href={`/cours/${encodeURIComponent(course.slug)}`}>Retour au cours</Link>
                )}
              </section>
            ) : <section className="card course-complete-card" aria-busy={saving}>
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
                  ) : nextCourse ? (
                    <div className="module-complete-next-actions">
                      <Link className="btn btn-primary" href={courseHref(nextCourse.slug)}>
                        Cours suivant : {nextCourse.titre} <ArrowRight size={17} aria-hidden="true" />
                      </Link>
                      <Link className="btn btn-outline" href={`/cours/${encodeURIComponent(course.slug)}`}>Revoir ce cours</Link>
                    </div>
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
            </section>}

            <CourseModuleNavigation canGoNext={isStaffPreview || isComplete} courseSlug={course.slug} navigation={navigation} />
          </section>
        </div>
      </div>
    </section>
  );
}
