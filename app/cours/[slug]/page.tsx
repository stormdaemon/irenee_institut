"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  LockKeyhole,
  Play,
  RotateCcw,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { formatDuration } from "@/lib/data";
import { buildCourseJourney } from "@/lib/course-experience";
import { createBrowserClient } from "@/lib/supabase";
import type { Course, ModuleProgress, Profile } from "@/lib/types";

type StudentCourse = Course & {
  completedModules?: number;
  progress?: number;
};

type CoursePayload = {
  courses: StudentCourse[];
  profile: Profile;
  progress: ModuleProgress[];
};

type PageStatus = "loading" | "ready" | "unauthenticated" | "error";

function moduleHref(slug: string, moduleId: string) {
  return `/cours/${encodeURIComponent(slug)}/modules/${encodeURIComponent(moduleId)}`;
}

export default function CoursePage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || "");
  const loginHref = `/auth/login?next=${encodeURIComponent(`/cours/${slug}`)}`;
  const [payload, setPayload] = useState<CoursePayload | null>(null);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadCourse() {
      setStatus("loading");
      setError("");
      try {
        const supabase = createBrowserClient();
        if (!supabase) throw new Error("Le service est momentanément indisponible. Réessayez dans quelques instants.");

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          if (!mounted) return;
          setError(sessionError?.message || "Connectez-vous pour accéder à ce cours.");
          setStatus("unauthenticated");
          return;
        }

        const response = await fetch(`/api/learning/courses/${encodeURIComponent(slug)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.ok !== true) {
          if (!mounted) return;
          setError(data?.error || "Le cours n'a pas pu être chargé.");
          setStatus(response.status === 401 ? "unauthenticated" : "error");
          return;
        }

        if (!mounted) return;
        setPayload({
          courses: data.course ? [data.course] : [],
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

    void loadCourse();
    return () => {
      mounted = false;
    };
  }, [reloadKey, slug]);

  const course = useMemo(() => payload?.courses.find(item => item.slug === slug), [payload, slug]);
  const journey = useMemo(
    () => buildCourseJourney(course?.modules || [], payload?.progress || []),
    [course?.modules, payload?.progress],
  );
  const remainingMinutes = useMemo(() => journey.modules.reduce((total, item) => {
    const duration = Number(item.module.duree || 0);
    return total + Math.max(0, Math.round(duration * (100 - item.progress) / 100));
  }, 0), [journey.modules]);

  if (status === "loading") {
    return (
      <section className="section course-state-page">
        <div className="container center">
          <div className="course-state-card" role="status" aria-live="polite" aria-busy="true">
            <Loader2 className="action-spin" size={34} aria-hidden="true" />
            <h1>Préparation de votre parcours</h1>
            <p>Nous retrouvons votre progression et le prochain module.</p>
          </div>
        </div>
      </section>
    );
  }

  if (status !== "ready" || !payload) {
    return (
      <section className="section course-state-page">
        <div className="container center">
          <div className="course-state-card">
            <AlertTriangle size={38} aria-hidden="true" />
            <h1>{status === "unauthenticated" ? "Connexion requise" : "Cours indisponible"}</h1>
            <p>{error}</p>
            <div className="course-state-actions">
              {status === "unauthenticated" ? (
                <Link href={loginHref} className="btn btn-primary">Se connecter</Link>
              ) : (
                <button className="btn btn-primary" type="button" onClick={() => setReloadKey(value => value + 1)}>
                  <RotateCcw size={17} aria-hidden="true" /> Réessayer
                </button>
              )}
              <Link href="/espace-etudiant" className="btn btn-outline">Mon espace</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!course) {
    return (
      <section className="section course-state-page">
        <div className="container center">
          <div className="course-state-card">
            <AlertTriangle size={38} aria-hidden="true" />
            <h1>Formation non accessible</h1>
            <p>Ce cours n'est pas encore disponible sur votre compte.</p>
            <Link href="/espace-etudiant" className="btn btn-primary">Retour à mon espace</Link>
          </div>
        </div>
      </section>
    );
  }

  const resume = journey.resumeModule;
  const finished = journey.completedCount === course.modules.length && course.modules.length > 0;
  const firstName = payload.profile.prenom || payload.profile.email;
  const competences = course.competences || [];
  const prerequisites = course.prerequis || [];
  const progressStyle = { "--journey-progress": `${journey.overallProgress}%` } as CSSProperties;

  return (
    <section className="section course-reader-page course-dashboard-page">
      <div className="container course-dashboard-container">
        <Link className="course-back-link" href="/espace-etudiant">← Mes formations</Link>

        <header className="course-dashboard-hero">
          <div className="course-dashboard-copy">
            <span className="course-eyebrow">Bonjour {firstName} · votre parcours</span>
            <h1>{course.titre}</h1>
            <p>{course.description}</p>
            <div className="course-dashboard-meta" aria-label="Informations sur le cours">
              <span><BookOpen size={17} aria-hidden="true" /> {course.modules.length} modules</span>
              <span><Clock size={17} aria-hidden="true" /> {formatDuration(course.duree_totale)} au total</span>
              <span className="badge">{course.niveau}</span>
            </div>
            {resume ? (
              <Link className="btn btn-primary course-resume-button" href={moduleHref(course.slug, resume.id)}>
                {finished ? <RotateCcw size={18} aria-hidden="true" /> : <Play size={18} fill="currentColor" aria-hidden="true" />}
                {journey.resumeLabel}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <p className="course-empty-program">Le programme de ce cours sera bientôt disponible.</p>
            )}
          </div>
          <div className="course-progress-summary" style={progressStyle}>
            <div
              className="course-progress-dial"
              role="progressbar"
              aria-label="Progression globale du cours"
              aria-valuenow={journey.overallProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <strong>{journey.overallProgress}<span>%</span></strong>
            </div>
            <div>
              <strong>{journey.completedCount} sur {course.modules.length}</strong>
              <span>modules terminés</span>
            </div>
            {!finished && remainingMinutes > 0 && <small>Environ {formatDuration(remainingMinutes)} restantes</small>}
            {finished && <small><Check size={15} aria-hidden="true" /> Parcours terminé</small>}
          </div>
        </header>

        <div className="course-dashboard-layout">
          <section className="course-syllabus" aria-labelledby="course-syllabus-heading">
            <div className="course-section-heading">
              <div>
                <span className="course-eyebrow">Votre itinéraire</span>
                <h2 id="course-syllabus-heading">Programme du cours</h2>
              </div>
              <span>{journey.completedCount}/{course.modules.length}</span>
            </div>

            {journey.modules.length ? (
              <ol className="course-syllabus-list">
                {journey.modules.map((item, index) => {
                  const isComplete = item.state === "complete";
                  const isCurrent = item.state === "current";
                  const actionLabel = isComplete ? "Revoir" : item.progress > 0 ? "Reprendre" : "Commencer";
                  return (
                    <li className={`course-syllabus-item is-${item.state}`} key={item.module.id}>
                      <div className="course-syllabus-marker" aria-hidden="true">
                        {isComplete ? <Check size={18} /> : isCurrent ? <Play size={16} fill="currentColor" /> : <LockKeyhole size={16} />}
                      </div>
                      <div className="course-syllabus-content">
                        <div className="course-syllabus-title-row">
                          <div>
                            <small>Module {index + 1}</small>
                            <h3>{item.module.titre}</h3>
                          </div>
                          <span className="course-module-state">
                            {isComplete ? "Terminé" : isCurrent ? item.progress > 0 ? "En cours" : "À commencer" : "Verrouillé"}
                          </span>
                        </div>
                        {item.module.description && <p>{item.module.description}</p>}
                        <div className="course-syllabus-footer">
                          <span><Clock size={15} aria-hidden="true" /> {item.module.duree || 0} min</span>
                          <span className="badge">{item.module.type || item.module.type_contenu || "texte"}</span>
                          {item.state === "locked" ? (
                            <span className="course-locked-copy">Terminez le module {journey.currentIndex + 1} pour le débloquer.</span>
                          ) : (
                            <Link className="course-module-action" href={moduleHref(course.slug, item.module.id)}>
                              {actionLabel} <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                        {(isCurrent || isComplete) && (
                          <div
                            className="course-progress-track"
                            role="progressbar"
                            aria-label={`Progression du module ${item.module.titre}`}
                            aria-valuenow={item.progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div style={{ width: `${item.progress}%` }} aria-hidden="true" />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="course-empty-syllabus" role="status">
                <BookOpen size={26} aria-hidden="true" />
                <p>Aucun module n'est encore publié dans ce cours.</p>
              </div>
            )}
          </section>

          <aside className="course-dashboard-aside" aria-label="Repères du cours">
            <section className="course-aside-card">
              <div className="course-aside-heading"><Target size={20} aria-hidden="true" /><h2>Objectifs</h2></div>
              {course.objectifs.length ? (
                <ul className="course-objectives-list">
                  {course.objectifs.map(item => <li key={item}><CheckCircle2 size={17} aria-hidden="true" /><span>{item}</span></li>)}
                </ul>
              ) : <p>Aucun objectif publié pour ce cours.</p>}
            </section>
            {(competences.length > 0 || prerequisites.length > 0) && (
              <details className="course-aside-card course-details-card">
                <summary>Compétences et prérequis</summary>
                {competences.length > 0 && <><h3>Compétences</h3><ul>{competences.map(item => <li key={item}>{item}</li>)}</ul></>}
                {prerequisites.length > 0 && <><h3>Prérequis</h3><ul>{prerequisites.map(item => <li key={item}>{item}</li>)}</ul></>}
              </details>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
