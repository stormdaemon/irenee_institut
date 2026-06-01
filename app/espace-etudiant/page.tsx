"use client";

import Link from "next/link";
import { AlertTriangle, Award, BookOpen, CalendarClock, CheckCircle2, ClipboardList, FileText, GraduationCap, Loader2, ScrollText, Settings, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearningDocumentButton } from "@/components/LearningDocumentButton";
import { LibraryPanel } from "@/components/LibraryPanel";
import { createBrowserClient } from "@/lib/supabase";
import { formatDuration } from "@/lib/data";
import type { BookRequest, Course, Homework, LibraryMembership, Profile } from "@/lib/types";
import type { LearningDocument } from "@/lib/learning-documents";

type StudentCourse = Course & {
  progress?: number;
  completedModules?: number;
};

type StudentPayload = {
  annualPass?: { expires_at: string } | null;
  curriculum?: { completed: boolean; completedCourses: number; totalCourses: number };
  documents?: LearningDocument[];
  libraryMembership?: LibraryMembership | null;
  bookRequests?: BookRequest[];
  finalExam?: { eligible: boolean; latestAttempt?: { score: number; passed: boolean } | null };
  profile: Profile;
  courses: StudentCourse[];
  homework: Homework[];
};

export default function StudentSpacePage() {
  const [payload, setPayload] = useState<StudentPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unauthenticated" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadStudentSpace() {
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
        setError(sessionError?.message || "Connectez-vous pour accéder à votre espace étudiant.");
        setStatus("unauthenticated");
        return;
      }

      const response = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
      });
      const data = await response.json().catch(() => null);

      if (!mounted) return;

      if (!response.ok || data?.ok !== true) {
        setError(data?.error || "Votre espace étudiant n'a pas pu être chargé.");
        setStatus(response.status === 401 ? "unauthenticated" : "error");
        return;
      }

      setPayload({
        annualPass: data.annualPass || null,
        curriculum: data.curriculum,
        documents: data.documents || [],
        libraryMembership: data.libraryMembership || null,
        bookRequests: data.bookRequests || [],
        finalExam: data.finalExam,
        profile: data.profile,
        courses: data.courses || [],
        homework: data.homework || []
      });
      setStatus("ready");
    }

    loadStudentSpace();
    return () => {
      mounted = false;
    };
  }, []);

  const activeCourses = payload?.courses || [];
  const homework = payload?.homework || [];
  const documents = payload?.documents || [];
  const completedModules = useMemo(
    () => activeCourses.reduce((sum, course) => sum + Number(course.completedModules || 0), 0),
    [activeCourses]
  );
  const totalModules = useMemo(
    () => activeCourses.reduce((sum, course) => sum + course.modules.length, 0),
    [activeCourses]
  );
  const globalProgress = totalModules ? Math.round((completedModules / totalModules) * 100) : 0;

  if (status === "loading") {
    return (
      <section className="section" style={{ minHeight: 680 }}>
        <div className="container center">
          <div className="card" style={{ padding: 42, maxWidth: 620, margin: "0 auto" }}>
            <Loader2 className="action-spin" size={34} />
            <h1 className="title" style={{ marginTop: 18 }}>Chargement de votre espace</h1>
            <p className="subtitle">Préparation de votre espace...</p>
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
            <h1 className="title" style={{ marginTop: 18 }}>{status === "unauthenticated" ? "Connexion requise" : "Espace indisponible"}</h1>
            <p className="subtitle">{error}</p>
            <Link href="/auth/login" className="btn btn-primary">Se connecter</Link>
          </div>
        </div>
      </section>
    );
  }

  const profile = payload.profile;

  return (
    <section className="section">
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <h1 className="title">Espace étudiant</h1>
            <p className="subtitle">Bienvenue {profile.prenom || profile.email}, retrouvez vos cours, devoirs, progression et informations personnelles.</p>
          </div>
          <Link href="/parametres" className="btn btn-outline"><Settings size={18} /> Paramètres du compte</Link>
        </div>

        <div className="kpi-grid" style={{ margin: "34px 0" }}>
          <div className="kpi"><BookOpen color="#3478ff" /><strong>{activeCourses.length}</strong><span>Cours accessibles</span></div>
          <div className="kpi"><TrendingUp color="#22c55e" /><strong>{globalProgress}%</strong><span>Progression globale</span></div>
          <div className="kpi"><ClipboardList color="#eab308" /><strong>{homework.length}</strong><span>Devoirs à rendre</span></div>
          <div className="kpi"><Award color="#a855f7" /><strong>{completedModules}</strong><span>Modules terminés</span></div>
        </div>

        <LibraryPanel membership={payload.libraryMembership} initialRequests={payload.bookRequests || []} />

        {payload.annualPass && (
          <div className="card" style={{ padding: 26, marginBottom: 28 }}>
            <span className="badge">Année scolaire active</span>
            <h2 className="font-display" style={{ color: "var(--navy)" }}>Pass annuel de l'institut d'apologétique saint Irénée</h2>
            <p className="muted">Accès illimité au cursus jusqu'au {new Date(payload.annualPass.expires_at).toLocaleDateString("fr-FR")}.</p>
            <p><strong>{payload.curriculum?.completedCourses || 0} / {payload.curriculum?.totalCourses || activeCourses.length}</strong> cours entièrement suivis.</p>
            <Link className="btn btn-primary" href="/examen-final"><GraduationCap size={18} /> {payload.finalExam?.eligible ? "Présenter l'examen final" : "Voir les conditions de l'examen"}</Link>
          </div>
        )}

        <div className="grid-3" style={{ alignItems: "start" }}>
          <div style={{ gridColumn: "span 2" }}>
            <h2 className="font-display" style={{ color: "var(--navy)" }}>Mes formations</h2>
            {activeCourses.length ? activeCourses.map((course) => {
              const progress = Number(course.progress || 0);
              const nextModule = course.modules.find(module => !module.id || progress < 100) || course.modules[0];
              return (
                <article className="card" key={course.id} style={{ padding: 26, marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                    <div>
                      <h3 className="font-display" style={{ color: "var(--navy)", fontSize: "1.55rem", marginTop: 0 }}>{course.titre}</h3>
                      <p className="muted">{course.description}</p>
                    </div>
                    <span className="badge">{course.niveau}</span>
                  </div>
                  <p style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span><BookOpen size={16} /> {course.modules.length} modules</span>
                    <span><CalendarClock size={16} /> {formatDuration(course.duree_totale)}</span>
                    <span><FileText size={16} /> Certificat</span>
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span>Progression</span><strong>{progress}%</strong>
                  </div>
                  <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
                  {nextModule && <p className="muted">Prochain module : {nextModule.titre}</p>}
                  <Link className="btn btn-outline" href={`/cours/${course.slug}`}>Accéder au cours</Link>
                </article>
              );
            }) : (
              <div className="card center" style={{ padding: "58px 20px", marginTop: 18 }}>
                <BookOpen size={58} color="var(--gold-2)" />
                <h3>Aucune formation active</h3>
                <p className="muted">Aucune formation n'est encore disponible sur votre compte.</p>
                <Link className="btn btn-primary" href="/formations">Voir les formations</Link>
              </div>
            )}
          </div>

          <aside>
            <div className="card" style={{ padding: 24, marginBottom: 22 }}>
              <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 0 }}>À faire</h2>
              {homework.length ? homework.slice(0, 4).map(item => (
                <div key={item.id} style={{ borderTop: "1px solid rgba(220, 180, 107, .22)", padding: "14px 0" }}>
                  <strong>{item.titre}</strong>
                  {item.date_limite && <p className="muted">Avant le {new Date(item.date_limite).toLocaleDateString("fr-FR")}</p>}
                </div>
              )) : <p className="muted">Aucun devoir disponible pour le moment.</p>}
              <Link className="btn btn-primary" href="/devoirs">Voir mes devoirs</Link>
            </div>
            <div className="card" style={{ padding: 24 }}>
              <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 0 }}>Dernières validations</h2>
              {completedModules ? (
                <p><CheckCircle2 size={17} color="#22c55e" /> {completedModules} module{completedModules > 1 ? "s" : ""} terminé{completedModules > 1 ? "s" : ""}</p>
              ) : (
                <p className="muted">Aucune validation enregistrée pour le moment.</p>
              )}
            </div>
            <div className="card" style={{ padding: 24, marginTop: 22 }}>
              <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 0 }}><ScrollText size={19} /> Mes parchemins</h2>
              {documents.length ? documents.slice(0, 6).map(document => (
                <div key={document.id} style={{ borderTop: "1px solid rgba(220, 180, 107, .22)", padding: "14px 0" }}>
                  <strong>{document.document_kind === "final_certificate" ? "Certificat nominatif" : document.module_title || document.course_title || "Parchemin de connaissance"}</strong>
                  <p className="muted">{new Date(document.issued_at).toLocaleDateString("fr-FR")}</p>
                  <LearningDocumentButton documentId={document.id} />
                </div>
              )) : <p className="muted">Vos parchemins apparaîtront ici au fil du cursus.</p>}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
