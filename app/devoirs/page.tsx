"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, ClipboardList, FileUp, Loader2, MessageSquare, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import type { Homework } from "@/lib/types";

type HomeworkStatus = "loading" | "ready" | "unauthenticated" | "error";

export default function HomeworkPage() {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [status, setStatus] = useState<HomeworkStatus>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadHomework() {
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
        setError(sessionError?.message || "Connectez-vous pour accéder à vos devoirs.");
        setStatus("unauthenticated");
        return;
      }

      const response = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
      });
      const data = await response.json().catch(() => null);

      if (!mounted) return;

      if (!response.ok || data?.ok !== true) {
        setError(data?.error || "Vos devoirs n'ont pas pu être chargés.");
        setStatus(response.status === 401 ? "unauthenticated" : "error");
        return;
      }

      setHomework(data.homework || []);
      setStatus("ready");
    }

    loadHomework();
    return () => {
      mounted = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <section className="section" style={{ minHeight: 680 }}>
        <div className="container center">
          <div className="card" style={{ padding: 42, maxWidth: 620, margin: "0 auto" }}>
            <Loader2 className="action-spin" size={34} />
            <h1 className="title" style={{ marginTop: 18 }}>Chargement des devoirs</h1>
            <p className="subtitle">Préparation de vos devoirs...</p>
          </div>
        </div>
      </section>
    );
  }

  if (status !== "ready") {
    return (
      <section className="section" style={{ minHeight: 680 }}>
        <div className="container center">
          <div className="card" style={{ padding: 42, maxWidth: 680, margin: "0 auto" }}>
            <AlertTriangle size={38} color="var(--gold-2)" />
            <h1 className="title" style={{ marginTop: 18 }}>{status === "unauthenticated" ? "Connexion requise" : "Devoirs indisponibles"}</h1>
            <p className="subtitle">{error}</p>
            <Link href="/auth/login" className="btn btn-primary">Se connecter</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section" style={{ minHeight: 680 }}>
      <div className="container">
        <Link href="/espace-etudiant">← Retour à l'espace étudiant</Link>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginTop: 28 }}>
          <div>
            <h1 className="title">Mes devoirs</h1>
            <p className="subtitle">Consignes, rendus, corrections et suivi des travaux à remettre.</p>
          </div>
          <Link className="btn btn-outline" href="/espace-etudiant"><ClipboardList size={18} /> Voir mon espace</Link>
        </div>

        <div className="kpi-grid" style={{ margin: "34px 0" }}>
          <div className="kpi"><ClipboardList color="#3478ff" /><strong>{homework.length}</strong><span>Assignés</span></div>
          <div className="kpi"><Clock color="#eab308" /><strong>{homework.length}</strong><span>À rendre</span></div>
          <div className="kpi"><CheckCircle2 color="#22c55e" /><strong>0</strong><span>Corrigés</span></div>
          <div className="kpi"><MessageSquare color="#a855f7" /><strong>0</strong><span>Retours formateur</span></div>
        </div>

        {homework.length ? (
          <div className="grid-2">
            {homework.map(item => (
              <article className="card" key={item.id} style={{ padding: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <ClipboardList color="var(--navy)" />
                  <span className="badge">À rendre</span>
                </div>
                <h2 className="font-display" style={{ color: "var(--navy)" }}>{item.titre}</h2>
                <p className="muted">{item.description}</p>
                {item.date_limite && <p><Clock size={16} /> Avant le {new Date(item.date_limite).toLocaleString("fr-FR")}</p>}
                <div className="soft-card" style={{ padding: 16, background: "#f7f9fc", boxShadow: "none" }}>
                  <label>Rendu étudiant</label>
                  <textarea className="input" rows={5} placeholder="Rédigez votre réponse ou ajoutez le lien vers votre document..." />
                  <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="btn btn-outline" type="button"><FileUp size={16} /> Joindre un fichier</button>
                    <button className="btn btn-primary" type="button"><PenLine size={16} /> Envoyer le devoir</button>
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card center" style={{ padding: "80px 20px", marginTop: 34 }}>
            <ClipboardList size={70} color="#c3cad5" />
            <h2>Aucun devoir</h2>
            <p className="muted">Aucun devoir n'est encore disponible pour le moment.</p>
          </div>
        )}
      </div>
    </section>
  );
}
