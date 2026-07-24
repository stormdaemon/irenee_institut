"use client";

import type { Course, Profile, Role } from "@/lib/types";
import type { AdminAccessAudit } from "@/lib/admin-access";
import { Calendar, Mail, Phone, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [accessAudit, setAccessAudit] = useState<AdminAccessAudit | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const [passFilter, setPassFilter] = useState<"all" | "with" | "without">("all");
  const [sort, setSort] = useState<"recent" | "ancien" | "nom">("recent");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    authenticatedFetch("/api/users").then(response => response.json()).then(setUsers).catch(() => setUsers([]));
    authenticatedFetch("/api/courses").then(response => response.json()).then(setCourses).catch(() => setCourses([]));
    refreshAccessAudit();
  }, []);

  const accessByUser = useMemo(() => new Map((accessAudit?.students || []).map(student => [student.id, student])), [accessAudit]);

  // Le pass annuel peut concerner n'importe quel compte : on le lit sur les pass
  // eux-mêmes plutôt que sur la liste des étudiants.
  const activePassUserIds = useMemo(
    () => new Set((accessAudit?.annualPasses || []).filter(pass => pass.isActive).map(pass => pass.user_id)),
    [accessAudit],
  );

  const filtered = useMemo(() => users.filter(user => {
    const matchText = !query
      || `${user.prenom} ${user.nom} ${user.email} ${user.telephone || ""}`.toLowerCase().includes(query.toLowerCase());
    const matchRole = role === "all" || user.role === role;
    const hasPass = activePassUserIds.has(user.id);
    const matchPass = passFilter === "all" || (passFilter === "with" ? hasPass : !hasPass);
    return matchText && matchRole && matchPass;
  }).sort((left, right) => {
    if (sort === "nom") return `${left.nom} ${left.prenom}`.localeCompare(`${right.nom} ${right.prenom}`, "fr");
    const leftDate = new Date(left.created_at || 0).getTime();
    const rightDate = new Date(right.created_at || 0).getTime();
    return sort === "ancien" ? leftDate - rightDate : rightDate - leftDate;
  }), [users, query, role, passFilter, sort, activePassUserIds]);

  const passCount = useMemo(() => filtered.filter(user => activePassUserIds.has(user.id)).length, [filtered, activePassUserIds]);

  async function refreshAccessAudit() {
    const data = await authenticatedFetch("/api/admin/access").then(response => response.json()).catch(() => null);
    if (data?.students) {
      setAccessAudit(data);
      return data as AdminAccessAudit;
    }
    return null;
  }

  async function openCourseModal(user: Profile) {
    const latestAudit = accessAudit || await refreshAccessAudit();
    const currentAccess = latestAudit?.students.find(student => student.id === user.id) || accessByUser.get(user.id);
    setSelected(user);
    setAssigned(currentAccess?.courses.map(enrollment => enrollment.course_id) || []);
  }

  async function updateRole(id: string, nextRole: Role) {
    setStatus("saving");
    setSuccessMessage("");
    setError("");
    const response = await authenticatedFetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role: nextRole })
    });
    const data = await response.json();
    if (response.ok && data.verified === true) {
      setUsers(users.map(user => user.id === id ? { ...user, role: nextRole } : user));
      setSuccessMessage("Rôle mis à jour.");
      setStatus("success");
      refreshAccessAudit();
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
    const response = await authenticatedFetch("/api/users", {
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
      refreshAccessAudit();
    } else {
      setError(data.error || "L'assignation des cours n'a pas pu être enregistrée.");
      setStatus("error");
    }
  }

  return (
    <section className="section">
      <div className="container">
        <a href="/admin">← Retour au tableau de bord</a>
        <div className="admin-page-head">
          <div>
            <h1 className="title">Gestion des utilisateurs</h1>
            <p className="subtitle">Étudiants, formateurs et directeurs</p>
          </div>
          <a className="btn btn-outline" href="/admin/access">Accès étudiants</a>
        </div>
        <ActionNotice status={status} success={successMessage || "Modification enregistrée."} error={error} />
        <div className="grid-4" style={{ margin: "30px 0" }}>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 14, top: 14, color: "#9aa5b5" }} size={18} />
            <input className="input" style={{ paddingLeft: 44 }} placeholder="Rechercher par nom, email ou téléphone..." value={query} onChange={event => setQuery(event.target.value)} />
          </div>
          <select className="input" aria-label="Filtrer par rôle" value={role} onChange={event => setRole(event.target.value as "all" | Role)}>
            <option value="all">Tous les rôles</option>
            <option value="etudiant">Étudiants</option>
            <option value="formateur">Formateurs</option>
            <option value="directeur">Directeurs</option>
          </select>
          <select className="input" aria-label="Filtrer par pass annuel" value={passFilter} onChange={event => setPassFilter(event.target.value as "all" | "with" | "without")}>
            <option value="all">Pass annuel : tous</option>
            <option value="with">Inscrits au pass</option>
            <option value="without">Non inscrits</option>
          </select>
          <select className="input" aria-label="Trier les utilisateurs" value={sort} onChange={event => setSort(event.target.value as "recent" | "ancien" | "nom")}>
            <option value="recent">Inscription récente</option>
            <option value="ancien">Inscription ancienne</option>
            <option value="nom">Nom (A → Z)</option>
          </select>
        </div>
        <p className="muted">
          {filtered.length} utilisateur{filtered.length > 1 ? "s" : ""} trouvé{filtered.length > 1 ? "s" : ""} · {passCount} avec pass annuel actif
        </p>
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Utilisateur</th><th>Email</th><th>Téléphone</th><th>Pass annuel</th><th>Rôle</th><th>Inscription</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id}>
                  <td><strong>{user.prenom} {user.nom}</strong></td>
                  <td><Mail size={15} /> {user.email}</td>
                  <td>{user.telephone ? <><Phone size={15} /> {user.telephone}</> : <span className="muted">—</span>}</td>
                  <td>
                    {activePassUserIds.has(user.id)
                      ? <span className="badge badge-success">Inscrit</span>
                      : <span className="muted">Non inscrit</span>}
                  </td>
                  <td>
                    <select className="input" value={user.role} onChange={event => updateRole(user.id, event.target.value as Role)}>
                      <option value="etudiant">Étudiant</option>
                      <option value="formateur">Formateur</option>
                      <option value="directeur">Directeur</option>
                    </select>
                  </td>
                  <td><Calendar size={15} /> {new Date(user.created_at || Date.now()).toLocaleDateString("fr-FR")}</td>
                  <td className="table-actions">
                    <button className="btn btn-outline" type="button" onClick={() => openCourseModal(user)}><Plus size={16} /> Cours</button>
                    <button className="btn btn-outline" type="button" aria-label={`Retirer ${user.prenom} ${user.nom} de cette vue`} onClick={() => setUsers(users.filter(item => item.id !== user.id))}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <div className="admin-course-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-course-modal-title">
            <div className="admin-course-modal">
              <div className="admin-course-modal-head">
                <div>
                  <h2 className="font-display" id="admin-course-modal-title">Assigner des cours</h2>
                  <p>{selected.prenom} {selected.nom}</p>
                </div>
                <button className="modal-close" type="button" aria-label="Fermer" onClick={() => setSelected(null)}><X size={18} /></button>
              </div>
              <div className="admin-course-list" aria-label="Cours disponibles">
                {courses.map(course => {
                  const checked = assigned.includes(course.id);
                  return (
                    <label className={`admin-course-option ${checked ? "selected" : ""}`} key={course.id}>
                      <input type="checkbox" checked={checked} onChange={() => setAssigned(checked ? assigned.filter(id => id !== course.id) : [...assigned, course.id])} />
                      <span>{course.titre}</span>
                    </label>
                  );
                })}
              </div>
              <div className="admin-course-modal-actions">
                <span>{assigned.length} cours sélectionné{assigned.length > 1 ? "s" : ""}</span>
                <button className="btn btn-primary" type="button" onClick={saveCourses} disabled={status === "saving"}>Enregistrer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
