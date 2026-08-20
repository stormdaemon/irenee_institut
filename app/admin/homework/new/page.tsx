"use client";

import type { Course, Profile } from "@/lib/types";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export default function NewHomeworkPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [courseId, setCourseId] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const students = useMemo(() => profiles.filter(profile => profile.role === "etudiant"), [profiles]);
  const allSelected = selectedStudents.size === students.length && students.length > 0;

  useEffect(() => {
    authenticatedFetch("/api/courses").then(response => response.json()).then(setCourses).catch(() => setCourses([]));
    authenticatedFetch("/api/users").then(response => response.json()).then(setProfiles).catch(() => setProfiles([]));
  }, []);

  function toggleAll() {
    setSelectedStudents(allSelected ? new Set() : new Set(students.map(student => student.id)));
  }

  function toggleStudent(id: string) {
    const next = new Set(selectedStudents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudents(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    selectedStudents.forEach(id => form.append("student_ids", id));
    const response = await authenticatedFetch("/api/homework", { method: "POST", body: form });
    const data = await response.json();
    if (response.ok && data.verified === true) {
      formElement.reset();
      setCourseId("");
      setSelectedStudents(new Set());
      setStatus("success");
      window.setTimeout(() => router.push("/admin/homework"), 1100);
    } else {
      setError(data.error || "Le devoir n'a pas pu être créé.");
      setStatus("error");
    }
  }

  const busy = status === "saving" || status === "success";

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 850 }}>
        <a href="/admin/homework">← Retour aux devoirs</a>
        <h1 className="title" style={{ marginTop: 28 }}>Créer un devoir</h1>
        {busy && (
          <div className={`completion-panel ${status === "success" ? "done" : ""}`}>
            {status === "saving" ? <Loader2 className="action-spin" size={44} /> : <CheckCircle2 className="completion-check" size={54} />}
            <h2>{status === "saving" ? "Création du devoir..." : "Devoir créé"}</h2>
            <p>{status === "saving" ? "Les étudiants sont en cours d'assignation." : "Retour à la liste des devoirs."}</p>
          </div>
        )}
        {status === "error" && <div className="action-notice action-error" role="alert">{error}</div>}
        {status !== "success" && (
          <form method="post" className={`card ${busy ? "form-disabled" : ""}`} style={{ padding: 30, marginTop: 30 }} onSubmit={submit}>
            <p>
              <label>Cours concerné *</label>
              <select className="input" name="course_id" value={courseId} onChange={event => setCourseId(event.target.value)} required disabled={busy}>
                <option value="">Sélectionnez un cours</option>
                {courses.map(course => <option key={course.id} value={course.id}>{course.titre}</option>)}
              </select>
            </p>
            <p><label>Titre du devoir *</label><input className="input" name="titre" placeholder="Ex: Dissertation sur l'argument cosmologique" required disabled={busy} /></p>
            <p><label>Description et consignes *</label><textarea className="input" name="description" rows={10} placeholder="Décrivez le devoir et les consignes à suivre..." required disabled={busy} /></p>
            <p><label>Date limite (optionnel)</label><input className="input" name="date_limite" type="datetime-local" disabled={busy} /></p>
            {courseId && (
              <div style={{ borderTop: "1px solid #e8edf5", paddingTop: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label>Étudiants concernés *</label>
                  <button className="btn btn-outline" type="button" onClick={toggleAll} disabled={busy}>{allSelected ? "Tout désélectionner" : "Tout sélectionner"}</button>
                </div>
                {students.map(student => (
                  <label className="soft-card" key={student.id} style={{ display: "flex", gap: 12, padding: 14, marginTop: 10 }}>
                    <input type="checkbox" checked={selectedStudents.has(student.id)} onChange={() => toggleStudent(student.id)} disabled={busy} />
                    <span><strong>{student.prenom} {student.nom}</strong><br /><small>{student.email}</small></span>
                  </label>
                ))}
                <p className="muted">{selectedStudents.size} étudiant{selectedStudents.size > 1 ? "s" : ""} sélectionné{selectedStudents.size > 1 ? "s" : ""}</p>
              </div>
            )}
            <button className="btn btn-primary" disabled={!courseId || selectedStudents.size === 0 || busy}><Save size={18} /> Créer le devoir</button>
          </form>
        )}
      </div>
    </section>
  );
}
