"use client";

import Link from "next/link";
import DOMPurify from "dompurify";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
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

type ModuleStatus = "loading" | "ready" | "saving" | "unauthenticated" | "error";

type Resource = {
  label: string;
  url: string;
};

const unsafeCssPattern = /@import|url\s*\(|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:/i;

function getSafeModuleCss(html: string) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map(match => match[1])
    .filter(css => !unsafeCssPattern.test(css))
    .join("\n");
}

function sanitizeModuleHtml(html: string) {
  const document = new DOMParser().parseFromString(DOMPurify.sanitize(html), "text/html");
  document.querySelectorAll<HTMLElement>("[style]").forEach(element => {
    if (unsafeCssPattern.test(element.getAttribute("style") || "")) {
      element.removeAttribute("style");
    }
  });
  return document.body.innerHTML;
}

function ModuleHtmlContent({ html, title }: { html: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const document = useMemo(() => {
    const sanitizedHtml = sanitizeModuleHtml(html);
    const sanitizedCss = getSafeModuleCss(html);
    return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; style-src 'unsafe-inline'; font-src 'none'; form-action 'none'" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html,body{margin:0;padding:0;background:transparent}body{overflow-wrap:anywhere}table{max-width:100%}</style>
    <style>${sanitizedCss}</style>
  </head>
  <body>${sanitizedHtml}</body>
</html>`;
  }, [html]);

  const syncHeight = useCallback(() => {
    const frame = frameRef.current;
    const root = frame?.contentDocument?.documentElement;
    const body = frame?.contentDocument?.body;
    if (!frame || !root || !body) return;
    frame.style.height = `${Math.max(root.scrollHeight, body.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(syncHeight);
    observer.observe(frame);
    window.addEventListener("resize", syncHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, [syncHeight]);

  return (
    <iframe
      ref={frameRef}
      className="module-html-frame"
      sandbox="allow-same-origin"
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
      if (typeof item === "string") return { label: `Ressource ${index + 1}`, url: item };
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const url = String(record.url || record.href || "");
      if (!url) return null;
      return { label: String(record.label || record.titre || record.title || `Ressource ${index + 1}`), url };
    })
    .filter(Boolean) as Resource[];
}

export default function ModulePage() {
  const params = useParams<{ slug: string; moduleId: string }>();
  const slug = String(params?.slug || "");
  const moduleId = String(params?.moduleId || "");
  const [payload, setPayload] = useState<ModulePayload | null>(null);
  const [status, setStatus] = useState<ModuleStatus>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadModule() {
      const supabase = createBrowserClient();
      if (!supabase) {
        if (!mounted) return;
        setError("Le service est momentanément indisponible. Réessayez dans quelques instants.");
        setStatus("error");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        if (!mounted) return;
        setError(sessionError?.message || "Connectez-vous pour accéder à ce module.");
        setStatus("unauthenticated");
        return;
      }

      const response = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
      });
      const data = await response.json().catch(() => null);

      if (!mounted) return;

      if (!response.ok || data?.ok !== true) {
        setError(data?.error || "Le module n'a pas pu être chargé.");
        setStatus(response.status === 401 ? "unauthenticated" : "error");
        return;
      }

      setPayload({
        courses: data.courses || [],
        progress: data.progress || []
      });
      setStatus("ready");
    }

    loadModule();
    return () => {
      mounted = false;
    };
  }, []);

  const course = useMemo(() => payload?.courses.find(item => item.slug === slug), [payload, slug]);
  const module = useMemo(() => course?.modules.find(item => item.id === moduleId), [course, moduleId]);
  const progress = useMemo(() => payload?.progress.find(item => item.module_id === moduleId), [payload, moduleId]);
  const resources = module ? getResources(module) : [];
  const isComplete = Boolean(progress?.complete) || Number(progress?.progression || 0) >= 100;

  async function markComplete() {
    if (!course || !module) return;
    const supabase = createBrowserClient();
    if (!supabase) return;

    setStatus("saving");
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      setError("Votre connexion a expiré. Reconnectez-vous pour enregistrer votre avancée.");
      setStatus("unauthenticated");
      return;
    }

    const response = await fetch("/api/progress/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`
      },
      body: JSON.stringify({
        course_id: course.id,
        module_id: module.id,
        complete: true,
        progression: 100
      })
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || data?.ok !== true) {
      setError(data?.error || "Votre avancée n'a pas pu être enregistrée.");
      setStatus("error");
      return;
    }

    setPayload(current => current ? {
      ...current,
      progress: [
        ...current.progress.filter(item => item.module_id !== module.id),
        { course_id: course.id, module_id: module.id, complete: true, progression: 100 }
      ]
    } : current);
    setStatus("ready");
  }

  if (status === "loading") {
    return (
      <section className="section" style={{ minHeight: 680 }}>
        <div className="container center">
          <div className="card" style={{ padding: 42, maxWidth: 620, margin: "0 auto" }}>
            <Loader2 className="action-spin" size={34} />
            <h1 className="title" style={{ marginTop: 18 }}>Chargement du module</h1>
            <p className="subtitle">Préparation du module...</p>
          </div>
        </div>
      </section>
    );
  }

  if (status === "unauthenticated" || status === "error") {
    return (
      <section className="section" style={{ minHeight: 680 }}>
        <div className="container center">
          <div className="card" style={{ padding: 42, maxWidth: 680, margin: "0 auto" }}>
            <AlertTriangle size={38} color="var(--gold-2)" />
            <h1 className="title" style={{ marginTop: 18 }}>{status === "unauthenticated" ? "Connexion requise" : "Module indisponible"}</h1>
            <p className="subtitle">{error}</p>
            <Link href="/auth/login" className="btn btn-primary">Se connecter</Link>
          </div>
        </div>
      </section>
    );
  }

  if (!course || !module) {
    return (
      <section className="section" style={{ minHeight: 680 }}>
        <div className="container center">
          <div className="card" style={{ padding: 42, maxWidth: 720, margin: "0 auto" }}>
            <AlertTriangle size={38} color="var(--gold-2)" />
            <h1 className="title" style={{ marginTop: 18 }}>Module non accessible</h1>
            <p className="subtitle">Ce module n'est pas encore disponible sur votre compte.</p>
            <Link href="/espace-etudiant" className="btn btn-primary">Retour à mon espace</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 880 }}>
        <Link href={`/cours/${course.slug}`}>← Retour au cours</Link>
        <div className="card" style={{ padding: 34, marginTop: 24 }}>
          <span className="badge">{module.type}</span>
          <h1 className="title">{module.titre}</h1>
          <p className="subtitle">{module.description}</p>
        </div>
        <div className="card" style={{ padding: 34, marginTop: 28 }}>
          {module.contenu_html ? (
            <ModuleHtmlContent html={module.contenu_html} title={module.titre} />
          ) : module.contenu ? (
            <p>{module.contenu}</p>
          ) : (
            <>
              <h2 className="font-display" style={{ color: "var(--navy)" }}>Contenu du module</h2>
              <p className="muted">Aucun contenu n'est encore publié pour ce module.</p>
            </>
          )}
        </div>
        <div className="card" style={{ padding: 34, marginTop: 28 }}>
          <h2 className="font-display" style={{ color: "var(--navy)" }}>Ressources téléchargeables</h2>
          {resources.length ? resources.map(resource => (
            <a className="btn btn-outline" href={resource.url} key={resource.url} target="_blank" rel="noreferrer">
              <Download size={18} /> {resource.label} <ExternalLink size={15} />
            </a>
          )) : <p className="muted">Aucune ressource n'est encore publiée pour ce module.</p>}
        </div>
        {Array.isArray(module.quiz) && module.quiz.length > 0 && (
          <div className="card" style={{ padding: 34, marginTop: 28 }}>
            <h2 className="font-display" style={{ color: "var(--navy)" }}>Quiz de validation</h2>
            {module.quiz.map((question, index) => (
              <div className="soft-card" style={{ padding: 18, marginTop: 14 }} key={`${question.question}-${index}`}>
                <h3>{question.question}</h3>
                {question.options.map(option => <p key={option}>{option}</p>)}
              </div>
            ))}
          </div>
        )}
        <div className="card center" style={{ padding: 34, marginTop: 28 }}>
          {isComplete ? (
            <p><CheckCircle2 size={17} color="#22c55e" /> Module terminé.</p>
          ) : (
            <>
              <p>Avez-vous terminé la lecture de ce module ?</p>
              <button className="btn btn-primary" type="button" onClick={markComplete} disabled={status === "saving"}>
                {status === "saving" && <Loader2 className="action-spin" size={18} />}
                {status === "saving" ? "Enregistrement..." : "Marquer comme terminé"}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
