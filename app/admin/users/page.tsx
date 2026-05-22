"use client";

import type { Course, Profile, Role } from "@/lib/types";
import { Calendar, Mail, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users").then(response => response.json()).then(setUsers).catch(() => setUsers([]));
    fetch("/api/courses").then(response => response.json()).then(setCourses).catch(() => setCourses([]));
  }, []);

  const filtered = useMemo(() => users.filter(user => {
    const matchText = !query || `${user.prenom} ${user.nom} ${user.email}`.toLowerCase().includes(query.toLowerCase());
    const matchRole = role === "all" || user.role === role;
    return matchText && matchRole;
  }), [users, query, role]);

  async function updateRole(id: string, nextRole: Role) {
    setStatus("saving");
    setSuccessMessage("");
    setError("");
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role: nextRole })
    });
    const data = await response.json();
    if (response.ok && data.verified === true) {
      setUsers(users.map(user => user.id === id ? { ...user, role: nextRole } : user));
      setSuccessMessage("Rôle mis à jour.");
      setStatus("success");
    } else {
      setError(data.error || "Le rôle n'a pas pu être enregistré.");
      setStatus("error");
    }
  }

  async function saveCourses() {
    if (!selected) return;
    setStatus("saving");
    setSuccessMessage("");
    setError("");
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, course_ids: assigned })
    });
    const data = await response.json();
    if (response.ok && data.verified === true) {
      setSelected(null);
      setAssigned([]);
      setSuccessMessage("Cours attribués.");
      setStatus("success");
    } else {
      setError(data.error || "L'assignation des cours n'a pas pu être enregistrée.");
      setStatus("error");
    }
  }

  return (
    <section className="section">
      <div className="container">
        <a href="/admin">← Retour au tableau de bord</a>
        <h1 className="title" style={{ marginTop: 28 }}>Gestion des utilisateurs</h1>
        <p className="subtitle">Étudiants, formateurs et directeurs</p>
        <ActionNotice status={status} success={successMessage || "Modification enregistrée."} error={error} />
        <div className="grid-2" style={{ margin: "30px 0" }}>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 14, top: 14, color: "#9aa5b5" }} size={18} />
            <input className="input" style={{ paddingLeft: 44 }} placeholder="Rechercher par nom, prénom ou email..." value={query} onChange={event => setQuery(event.target.value)} />
          </div>
          <select className="input" value={role} onChange={event => setRole(event.target.value as "all" | Role)}>
            <option value="all">Tous les rôles</option>
            <option value="etudiant">Étudiants</option>
            <option value="formateur">Formateurs</option>
            <option value="directeur">Directeurs</option>
          </select>
        </div>
        <p className="muted">{filtered.length} utilisateur{filtered.length > 1 ? "s" : ""} trouvé{filtered.length > 1 ? "s" : ""}</p>
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Inscription</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id}>
                  <td><strong>{user.prenom} {user.nom}</strong></td>
                  <td><Mail size={15} /> {user.email}</td>
                  <td>
                    <select className="input" value={user.role} onChange={event => updateRole(user.id, event.target.value as Role)}>
                      <option value="etudiant">Étudiant</option>
                      <option value="formateur">Formateur</option>
                      <option value="directeur">Directeur</option>
                    </select>
                  </td>
                  <td><Calendar size={15} /> {new Date(user.created_at || Date.now()).toLocaleDateString("fr-FR")}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-outline" onClick={() => setSelected(user)}><Plus size={16} /> Cours</button>
                    <button className="btn btn-outline" onClick={() => setUsers(users.filter(item => item.id !== user.id))}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 50 }}>
            <div className="card" style={{ width: "min(680px, calc(100% - 30px))", padding: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div><h2 className="font-display" style={{ color: "var(--navy)", margin: 0 }}>Assigner des cours</h2><p>{selected.prenom} {selected.nom}</p></div>
                <button className="btn btn-outline" onClick={() => setSelected(null)}><X size={16} /></button>
              </div>
              {courses.map(course => (
                <label key={course.id} style={{ display: "flex", gap: 12, padding: 14, background: "#f7f9fc", marginTop: 8 }}>
                  <input type="checkbox" checked={assigned.includes(course.id)} onChange={() => setAssigned(assigned.includes(course.id) ? assigned.filter(id => id !== course.id) : [...assigned, course.id])} />
                  {course.titre}
                </label>
              ))}
              <p style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{assigned.length} cours sélectionné{assigned.length > 1 ? "s" : ""}</span><button className="btn btn-primary" onClick={saveCourses}>Enregistrer</button></p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
