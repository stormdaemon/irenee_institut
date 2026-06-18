"use client";

import Link from "next/link";
import { CalendarClock, ExternalLink, Loader2, Radio, Save, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

type AdminLiveSession = {
  id: string;
  titre: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  course_id: string | null;
  daily_room_url: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
};

type CourseOption = { id: string; titre: string };

const statusLabels: Record<AdminLiveSession["status"], string> = {
  scheduled: "Programmée",
  live: "En direct",
  ended: "Terminée",
  cancelled: "Annulée"
};

const emptyForm = { titre: "", description: "", starts_at: "", ends_at: "", course_id: "" };

export default function AdminLivePage() {
  const [sessions, setSessions] = useState<AdminLiveSession[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function loadSessions() {
    const response = await authenticatedFetch("/api/admin/live");
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok) setSessions(data.sessions || []);
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([
      authenticatedFetch("/api/admin/live").then(r => r.json()).catch(() => null),
      authenticatedFetch("/api/courses").then(r => r.json()).catch(() => null)
    ]).then(([liveData, courseData]) => {
      if (!mounted) return;
      if (liveData?.ok) setSessions(liveData.sessions || []);
      if (Array.isArray(courseData)) setCourses(courseData.map((c: { id: string; titre: string }) => ({ id: c.id, titre: c.titre })));
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  function update<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    const response = await authenticatedFetch("/api/admin/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titre: form.titre,
        description: form.description,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : "",
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : "",
        course_id: form.course_id || null
      })
    });
    const data = await response.json().catch(() => null);

    if (response.ok && data?.ok) {
      setStatus("success");
      setForm(emptyForm);
      await loadSessions();
    } else {
      setError(data?.error || "La séance n'a pas pu être créée.");
      setStatus("error");
    }
  }

  async function changeStatus(id: string, next: AdminLiveSession["status"]) {
    const response = await authenticatedFetch(`/api/admin/live/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next })
    });
    if (response.ok) await loadSessions();
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 1040 }}>
        <a href="/admin">Retour au tableau de bord</a>
        <h1 className="title" style={{ marginTop: 28 }}><Radio size={26} /> Séances en direct</h1>
        <p className="subtitle">Créez les séances visio hebdomadaires. La salle Daily est générée automatiquement et accessible aux étudiants depuis leur espace, sans compte tiers.</p>

        <form className="card" style={{ padding: 30, marginTop: 24 }} onSubmit={submit}>
          <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 0 }}>Nouvelle séance</h2>
          <p>
            <label>Titre</label>
            <input className="input" value={form.titre} onChange={event => update("titre", event.target.value)} placeholder="Séance hebdomadaire d'apologétique" required />
          </p>
          <p>
            <label>Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={event => update("description", event.target.value)} placeholder="Thème de la séance, intervenant, points abordés..." />
          </p>
          <div className="grid-2">
            <p>
              <label>Début</label>
              <input className="input" type="datetime-local" value={form.starts_at} onChange={event => update("starts_at", event.target.value)} required />
            </p>
            <p>
              <label>Fin (optionnel)</label>
              <input className="input" type="datetime-local" value={form.ends_at} onChange={event => update("ends_at", event.target.value)} />
            </p>
          </div>
          <p>
            <label>Cours associé (optionnel)</label>
            <select className="input" value={form.course_id} onChange={event => update("course_id", event.target.value)}>
              <option value="">Ouverte à tous les étudiants (pass annuel)</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>{course.titre}</option>
              ))}
            </select>
          </p>
          <ActionNotice status={status} success="Séance créée et salle Daily générée." error={error} />
          <p><button className="btn btn-primary" disabled={status === "saving"}><Save size={18} /> {status === "saving" ? "Création..." : "Créer la séance"}</button></p>
        </form>

        <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 36 }}>Séances</h2>
        {loading ? (
          <div className="card center" style={{ padding: 40 }}><Loader2 className="action-spin" size={28} /></div>
        ) : sessions.length ? (
          sessions.map(session => (
            <article className="card" key={session.id} style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ color: "var(--navy)", marginTop: 0 }}>{session.titre}</h3>
                  {session.description && <p className="muted">{session.description}</p>}
                  <p style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span><CalendarClock size={16} /> {new Date(session.starts_at).toLocaleString("fr-FR")}</span>
                    <span className="badge">{statusLabels[session.status]}</span>
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch", minWidth: 180 }}>
                  <Link className="btn btn-outline" href={`/direct/${session.id}`}><Video size={16} /> Rejoindre</Link>
                  {session.daily_room_url && (
                    <a className="btn btn-outline" href={session.daily_room_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Salle Daily</a>
                  )}
                  <select className="input" value={session.status} onChange={event => changeStatus(session.id, event.target.value as AdminLiveSession["status"])}>
                    <option value="scheduled">Programmée</option>
                    <option value="live">En direct</option>
                    <option value="ended">Terminée</option>
                    <option value="cancelled">Annulée</option>
                  </select>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="card center" style={{ padding: 40 }}>
            <Video size={48} color="var(--gold-2)" />
            <p className="muted">Aucune séance pour le moment.</p>
          </div>
        )}
      </div>
    </section>
  );
}
