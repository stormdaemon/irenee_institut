"use client";

import Link from "next/link";
import { AlertTriangle, Award, BookOpen, CheckCircle2, Clock, Loader2, PlayCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatDuration } from "@/lib/data";
import { createBrowserClient } from "@/lib/supabase";
import type { Course, ModuleProgress, Profile } from "@/lib/types";

type StudentCourse = Course & {
  progress?: number;
  completedModules?: number;
};

type CoursePayload = {
  profile: Profile;
  courses: StudentCourse[];
  progress: ModuleProgress[];
};

type PageStatus = "loading" | "ready" | "unauthenticated" | "error";

export default function CoursePage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || "");
  const loginHref = `/auth/login?next=${encodeURIComponent(`/cours/${slug}`)}`;
  const [payload, setPayload] = useState<CoursePayload | null>(null);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadCourse() {
      const supabase = createBrowserClient();
      if (!supabase) {
        if (!mounted) return;
        setError("Le service est momentanément indisponible. Réessayez dans quelques instants.");
        setStatus("error");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        if (!mounted) return;
        setError(sessionError?.message || "Connectez-vous pour accéder à ce cours.");
        setStatus("unauthenticated");
        return;
      }

      const response = await fetch(`/api/learning/courses/${encodeURIComponent(slug)}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);

      if (!mounted) return;

      if (!response.ok || data?.ok !== true) {
        setError(data?.error || "Le cours n'a pas pu être chargé.");
        setStatus(response.status === 401 ? "unauthenticated" : "error");
        return;
      }

      setPayload({
        profile: data.profile,
        courses: data.course ? [data.course] : [],
        progress: data.progress || []
      });
      setStatus("ready");
    }

    loadCourse();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const course = useMemo(() => payload?.courses.find(item => item.slug === slug), [payload, slug]);
  const progressByModule = useMemo(() => new Map((payload?.progress || []).map(item => [item.module_id, item])), [payload]);

  if (status === "loading") {
    return (
      <section className="section" style={{ minHeight: 680 }}>
        <div className="container center">
          <div className="card" role="status" aria-live="polite" aria-busy="true" style={{ padding: 42, maxWidth: 620, margin: "0 auto" }}>
            <Loader2 className="action-spin" size={34} />
            <h1 className="title" style={{ marginTop: 18 }}>Chargement du cours</h1>
            <p className="subtitle">Préparation de votre cours...</p>
          </div>
        </div>
      </section>
    );
  }

  if (status !== "ready" || !payload) {
    return (
      <section className="section" style={{ minHeight: 680 }}>
        <div className="container center">
          <div className="card" style={{ padding: 42, maxWidth: 680, margin: "0 auto" }}>
            <AlertTriangle size={38} color="var(--gold-2)" />
            <h1 className="title" style={{ marginTop: 18 }}>{status === "unauthenticated" ? "Connexion requise" : "Cours indisponible"}</h1>
            <p className="subtitle">{error}</p>
            <Link href={status === "unauthenticated" ? loginHref : "/espace-etudiant"} className="btn btn-primary">
              {status === "unauthenticated" ? "Se connecter" : "Retour à mon espace"}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!course) {
    return (
      <section className="section" style={{ minHeight: 680 }}>
        <div className="container center">
          <div className="card" style={{ padding: 42, maxWidth: 720, margin: "0 auto" }}>
            <AlertTriangle size={38} color="var(--gold-2)" />
            <h1 className="title" style={{ marginTop: 18 }}>Formation non accessible</h1>
            <p className="subtitle">Ce cours n'est pas encore disponible sur votre compte.</p>
            <Link href="/espace-etudiant" className="btn btn-primary">Retour à mon espace</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section course-reader-page">
      <div className="container">
        <Link className="course-back-link" href="/espace-etudiant">← Retour à l'espace étudiant</Link>
        <div className="card course-hero-card">
          <h1 className="title">{course.titre}</h1>
          <p className="subtitle">{course.description}</p>
          <p className="course-meta-row">
            <span className="badge">{course.niveau}</span>
            <span><BookOpen size={16} /> {course.modules.length} modules</span>
            <span><Clock size={16} /> {formatDuration(course.duree_totale)} de contenu</span>
            <span><Award size={16} /> Certificat</span>
          </p>
          <div className="course-welcome">
            Bon retour, {payload.profile.prenom || payload.profile.email}
          </div>
        </div>
        <div className="course-reader-layout">
          <div>
            <h2 className="font-display" style={{ color: "var(--navy)" }}>Contenu de la formation</h2>
            {course.modules.map((module, index) => {
              const moduleProgress = progressByModule.get(module.id);
              const rawProgress = moduleProgress?.complete ? 100 : Number(moduleProgress?.progression || 0);
              const progress = Number.isFinite(rawProgress) ? Math.min(100, Math.max(0, rawProgress)) : 0;
              const isComplete = progress >= 100;
              return (
                <article className="card course-module-card" key={module.id}>
                  <div className="course-module-row">
                    <div className="course-module-icon">{isComplete ? <CheckCircle2 color="#55d66f" /> : <PlayCircle color="var(--gold-2)" />}</div>
                    <div className="course-module-body">
                      <small>Module {index + 1}</small>
                      <h3 className="font-display" style={{ color: "var(--navy)", fontSize: "1.35rem", marginTop: 4 }}>{module.titre}</h3>
                      <p className="muted">{module.description}</p>
                      <p className="course-module-meta"><Clock size={15} /> {module.duree} min <span className="badge">{module.type}</span></p>
                      <div
                        className="course-progress-track"
                        role="progressbar"
                        aria-label={`Progression du module ${module.titre}`}
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div style={{ width: `${progress}%` }} aria-hidden="true" />
                      </div>
                      <Link className="btn btn-outline" href={`/cours/${course.slug}/modules/${module.id}`}>{isComplete ? "Revoir" : "Commencer"}</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="card course-objectives-card">
            <h3 className="font-display" style={{ color: "var(--navy)" }}>Objectifs de la formation</h3>
            {course.objectifs.length ? (
              <ul className="course-objectives-list">
                {course.objectifs.map(item => (
                  <li key={item}><CheckCircle2 size={17} color="#22c55e" aria-hidden="true" /> <span>{item}</span></li>
                ))}
              </ul>
            ) : <p className="muted">Aucun objectif publié pour ce cours.</p>}
          </aside>
        </div>
      </div>
    </section>
  );
}
