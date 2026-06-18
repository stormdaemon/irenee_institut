"use client";

import type { Course, CourseModule } from "@/lib/types";
import { Check, FileText, GripVertical, Plus, Save, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";
import { RichHtmlEditor } from "@/components/RichHtmlEditor";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

type ModuleDraft = {
  id?: string;
  titre: string;
  description: string;
  contenu_html: string;
  url_video: string;
  duree: number;
  type_contenu: string;
  ordre: number;
};

type CourseDraft = {
  id?: string;
  titre: string;
  slug: string;
  description: string;
  image_url: string;
  niveau: string;
  statut: string;
  semestre: number;
  numero: number;
  prix: string;
  prix_reduit: string;
  duree_totale_minutes: number;
  url_paiement_paypal: string;
  objectifs: string[];
  competences: string[];
  prerequis: string[];
  modules: ModuleDraft[];
};

const emptyModule = (ordre = 1): ModuleDraft => ({
  titre: "",
  description: "",
  contenu_html: "",
  url_video: "",
  duree: 150,
  type_contenu: "texte",
  ordre,
});

const emptyDraft = (): CourseDraft => ({
  titre: "",
  slug: "",
  description: "",
  image_url: "",
  niveau: "debutant",
  statut: "brouillon",
  semestre: 1,
  numero: 0,
  prix: "99",
  prix_reduit: "99",
  duree_totale_minutes: 750,
  url_paiement_paypal: "",
  objectifs: [""],
  competences: [""],
  prerequis: [""],
  modules: [emptyModule(1)],
});

function eurosFromCents(value?: number | null) {
  return String(Number(value || 0) / 100).replace(".", ",");
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function moduleFromDb(module: CourseModule, index: number): ModuleDraft {
  return {
    id: module.id,
    titre: module.titre || "",
    description: module.description || "",
    contenu_html: module.contenu_html || module.contenu || "",
    url_video: module.url_video || "",
    duree: Number(module.duree || 0),
    type_contenu: module.type_contenu || module.type || "texte",
    ordre: module.ordre ?? index + 1,
  };
}

function draftFromCourse(course: Course): CourseDraft {
  return {
    id: course.id,
    titre: course.titre,
    slug: course.slug,
    description: course.description || "",
    image_url: course.image_url || "",
    niveau: course.niveau || "debutant",
    statut: course.statut || "brouillon",
    semestre: Number(course.semestre || 1),
    numero: Number(course.numero || 0),
    prix: eurosFromCents(course.prix),
    prix_reduit: eurosFromCents(course.prix_reduit),
    duree_totale_minutes: Number(course.duree_totale_minutes || course.duree_totale || 0),
    url_paiement_paypal: (course as Course & { url_paiement_paypal?: string | null }).url_paiement_paypal || "",
    objectifs: course.objectifs?.length ? course.objectifs : [""],
    competences: course.competences?.length ? course.competences : [""],
    prerequis: course.prerequis?.length ? course.prerequis : [""],
    modules: course.modules?.length ? course.modules.map(moduleFromDb) : [emptyModule(1)],
  };
}

function cleanList(values: string[]) {
  return values.map(value => value.trim()).filter(Boolean);
}

export default function AdminCoursesPage() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [draft, setDraft] = useState<CourseDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [draggedModule, setDraggedModule] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const selectedCourse = useMemo(() => courses.find(course => course.id === draft.id), [courses, draft.id]);

  useEffect(() => {
    refreshCourses();
  }, []);

  useEffect(() => {
    const requestedCourse = searchParams.get("course");
    if (!requestedCourse || !courses.length || draft.id === requestedCourse) return;

    const course = courses.find(item => item.id === requestedCourse || item.slug === requestedCourse);
    if (course) selectCourse(course, false);
  }, [courses, draft.id, searchParams]);

  async function refreshCourses() {
    const next = await authenticatedFetch("/api/courses").then(response => response.json()).catch(() => []);
    const normalized = Array.isArray(next) ? next : [];
    setCourses(normalized);
    return normalized as Course[];
  }

  function update<K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  function updateList(key: "objectifs" | "competences" | "prerequis", index: number, value: string) {
    setDraft(current => ({ ...current, [key]: current[key].map((item, i) => i === index ? value : item) }));
  }

  function addListItem(key: "objectifs" | "competences" | "prerequis") {
    setDraft(current => ({ ...current, [key]: [...current[key], ""] }));
  }

  function removeListItem(key: "objectifs" | "competences" | "prerequis", index: number) {
    setDraft(current => {
      const next = current[key].filter((_, i) => i !== index);
      return { ...current, [key]: next.length ? next : [""] };
    });
  }

  function updateModule(index: number, patch: Partial<ModuleDraft>) {
    setDraft(current => ({
      ...current,
      modules: current.modules.map((module, i) => i === index ? { ...module, ...patch } : module),
    }));
  }

  function addModule() {
    setDraft(current => ({ ...current, modules: [...current.modules, emptyModule(current.modules.length + 1)] }));
  }

  function removeModule(index: number) {
    setDraft(current => {
      const next = current.modules.filter((_, i) => i !== index).map((module, i) => ({ ...module, ordre: i + 1 }));
      return { ...current, modules: next.length ? next : [emptyModule(1)] };
    });
  }

  function moveModule(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setDraft(current => {
      const next = [...current.modules];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...current, modules: next.map((module, index) => ({ ...module, ordre: index + 1 })) };
    });
  }

  function selectCourse(course: Course, shouldScroll = true) {
    setDraft(draftFromCourse(course));
    setStatus("idle");
    setError("");
    if (shouldScroll) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newCourse() {
    setDraft(emptyDraft());
    setStatus("idle");
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("saving");
    setError("");

    const form = new FormData();
    form.set("titre", draft.titre);
    form.set("slug", draft.slug || slugify(draft.titre));
    form.set("description", draft.description);
    form.set("image_url", draft.image_url);
    form.set("niveau", draft.niveau);
    form.set("statut", draft.statut);
    form.set("semestre", String(draft.semestre || 1));
    form.set("numero", String(draft.numero || 0));
    form.set("prix", draft.prix.replace(",", "."));
    form.set("prix_reduit", draft.prix_reduit.replace(",", "."));
    form.set("duree_totale_minutes", String(draft.duree_totale_minutes || 0));
    form.set("url_paiement_paypal", draft.url_paiement_paypal);
    form.set("objectifs", JSON.stringify(cleanList(draft.objectifs)));
    form.set("competences", JSON.stringify(cleanList(draft.competences)));
    form.set("prerequis", JSON.stringify(cleanList(draft.prerequis)));
    form.set("modules", JSON.stringify(draft.modules.filter(module => module.titre.trim()).map((module, index) => ({ ...module, ordre: index + 1 }))));
    form.set("nb_modules", String(draft.modules.filter(module => module.titre.trim()).length));

    const url = draft.id ? `/api/courses/${draft.id}` : "/api/courses";
    const response = await authenticatedFetch(url, { method: draft.id ? "PATCH" : "POST", body: form });
    const data = await response.json();

    if (response.ok && data.verified === true) {
      const next = await refreshCourses();
      const savedId = data.data?.id || draft.id;
      const saved = next.find(course => course.id === savedId);
      if (saved) setDraft(draftFromCourse(saved));
      setStatus("success");
    } else {
      setError(data.error || "Le cours n'a pas pu être enregistré.");
      setStatus("error");
    }
    setSaving(false);
  }

  return (
    <section className="section">
      <div className="container">
        <a href="/admin">← Retour au tableau de bord</a>
        <div className="admin-page-head">
          <div>
            <h1 className="title">Gestion des cours</h1>
            <p className="subtitle">Créer, éditer, publier et structurer les modules.</p>
          </div>
          <button className="btn btn-primary" type="button" onClick={newCourse}><Plus size={18} /> Nouveau cours</button>
        </div>

        <ActionNotice status={status} success="Cours enregistré." error={error} />

        <div className="course-admin-layout">
          <form className="course-editor card" onSubmit={submit}>
            <div className="course-editor-head">
              <div>
                <span className="badge">{draft.id ? "Modification" : "Création"}</span>
                <h2 className="font-display">{draft.id ? draft.titre || "Cours sélectionné" : "Nouveau cours"}</h2>
              </div>
              {selectedCourse && <span className="muted">{selectedCourse.modules?.length || 0} module(s)</span>}
            </div>

            <div className="grid-2">
              <p><label>Titre du cours *</label><input className="input" value={draft.titre} onChange={event => update("titre", event.target.value)} onBlur={() => !draft.slug && update("slug", slugify(draft.titre))} required /></p>
              <p><label>Slug URL *</label><input className="input" value={draft.slug} onChange={event => update("slug", slugify(event.target.value))} required /></p>
            </div>
            <p><label>Description courte *</label><textarea className="input" rows={4} value={draft.description} onChange={event => update("description", event.target.value)} required /></p>
            <p><label>Image de couverture</label><input className="input" value={draft.image_url} onChange={event => update("image_url", event.target.value)} placeholder="URL ou chemin image" /></p>

            <div className="grid-4">
              <p><label>Statut</label><select className="input" value={draft.statut} onChange={event => update("statut", event.target.value)}><option value="brouillon">Brouillon</option><option value="en_preparation">En préparation</option><option value="publie">Publié</option><option value="archive">Archivé</option></select></p>
              <p><label>Niveau</label><select className="input" value={draft.niveau} onChange={event => update("niveau", event.target.value)}><option value="debutant">Débutant</option><option value="intermediaire">Intermédiaire</option><option value="avance">Avancé</option></select></p>
              <p><label>Semestre</label><input className="input" type="number" value={draft.semestre} onChange={event => update("semestre", Number(event.target.value))} /></p>
              <p><label>Ordre</label><input className="input" type="number" value={draft.numero} onChange={event => update("numero", Number(event.target.value))} /></p>
            </div>

            <div className="grid-3">
              <p><label>Prix normal (€)</label><input className="input" inputMode="decimal" value={draft.prix} onChange={event => update("prix", event.target.value)} /></p>
              <p><label>Prix réduit (€)</label><input className="input" inputMode="decimal" value={draft.prix_reduit} onChange={event => update("prix_reduit", event.target.value)} /></p>
              <p><label>Durée totale (min)</label><input className="input" type="number" value={draft.duree_totale_minutes} onChange={event => update("duree_totale_minutes", Number(event.target.value))} /></p>
            </div>
            <p><label>URL de paiement</label><input className="input" value={draft.url_paiement_paypal} onChange={event => update("url_paiement_paypal", event.target.value)} placeholder="https://..." /></p>

            <CourseListEditor title="Objectifs pédagogiques" values={draft.objectifs} onAdd={() => addListItem("objectifs")} onChange={(index, value) => updateList("objectifs", index, value)} onRemove={index => removeListItem("objectifs", index)} />
            <CourseListEditor title="Compétences" values={draft.competences} onAdd={() => addListItem("competences")} onChange={(index, value) => updateList("competences", index, value)} onRemove={index => removeListItem("competences", index)} />
            <CourseListEditor title="Prérequis" values={draft.prerequis} onAdd={() => addListItem("prerequis")} onChange={(index, value) => updateList("prerequis", index, value)} onRemove={index => removeListItem("prerequis", index)} />

            <div className="module-editor-head">
              <h3>Modules du cours</h3>
              <button type="button" className="btn btn-outline" onClick={addModule}><Plus size={16} /> Ajouter un module</button>
            </div>
            {draft.modules.map((module, index) => (
              <div
                className="module-editor"
                key={module.id || index}
                draggable
                onDragStart={() => setDraggedModule(index)}
                onDragOver={event => event.preventDefault()}
                onDrop={() => {
                  if (draggedModule !== null) moveModule(draggedModule, index);
                  setDraggedModule(null);
                }}
                onDragEnd={() => setDraggedModule(null)}
              >
                <div className="module-editor-top">
                  <span className="badge"><GripVertical size={14} /> Module {index + 1}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="icon-button" aria-label="Monter le module" onClick={() => moveModule(index, index - 1)} disabled={index === 0}>↑</button>
                    <button type="button" className="icon-button" aria-label="Descendre le module" onClick={() => moveModule(index, index + 1)} disabled={index === draft.modules.length - 1}>↓</button>
                    <button type="button" className="icon-button danger" aria-label="Supprimer le module" onClick={() => removeModule(index)}><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="grid-2">
                  <p><label>Titre *</label><input className="input" value={module.titre} onChange={event => updateModule(index, { titre: event.target.value })} /></p>
                  <p><label>Type</label><select className="input" value={module.type_contenu} onChange={event => updateModule(index, { type_contenu: event.target.value })}><option value="texte">Texte</option><option value="video">Vidéo</option><option value="quiz">Quiz</option></select></p>
                </div>
                <p><label>Description</label><textarea className="input" rows={2} value={module.description} onChange={event => updateModule(index, { description: event.target.value })} /></p>
                <div className="grid-2">
                  <p><label>Durée (min)</label><input className="input" type="number" value={module.duree} onChange={event => updateModule(index, { duree: Number(event.target.value) })} /></p>
                  <p><label>URL vidéo</label><input className="input" value={module.url_video} onChange={event => updateModule(index, { url_video: event.target.value })} /></p>
                </div>
                <div>
                  <label>Contenu du module</label>
                  <RichHtmlEditor value={module.contenu_html} onChange={value => updateModule(index, { contenu_html: value })} />
                </div>
              </div>
            ))}

            <div className="editor-actions">
              <button className="btn btn-primary" disabled={saving}><Save size={18} /> {saving ? "Enregistrement..." : draft.id ? "Enregistrer les modifications" : "Créer le cours"}</button>
              <button className="btn btn-outline" type="button" onClick={() => setDraft(draft.id && selectedCourse ? draftFromCourse(selectedCourse) : emptyDraft())}><X size={18} /> Annuler</button>
            </div>
          </form>

          <aside className="course-list-panel">
            <h2 className="font-display">Cours existants</h2>
            <div className="course-list">
              {courses.map(course => (
                <button className={`course-list-item ${course.id === draft.id ? "active" : ""}`} key={course.id} type="button" onClick={() => selectCourse(course)}>
                  <span className="course-list-title"><FileText size={18} /> {course.titre}</span>
                  <span className="muted">{course.modules?.length || course.nb_modules || 0} modules · {course.statut || "brouillon"}</span>
                  {course.id === draft.id && <Check size={18} />}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function CourseListEditor({ title, values, onAdd, onChange, onRemove }: {
  title: string;
  values: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="list-editor">
      <div className="module-editor-head">
        <h3>{title}</h3>
        <button type="button" className="btn btn-outline" onClick={onAdd}><Plus size={16} /> Ajouter</button>
      </div>
      {values.map((item, index) => (
        <div className="list-row" key={index}>
          <input className="input" value={item} onChange={event => onChange(index, event.target.value)} />
          <button type="button" className="icon-button" onClick={() => onRemove(index)} aria-label={`Supprimer ${title.toLowerCase()}`}><Trash2 size={16} /></button>
        </div>
      ))}
    </div>
  );
}
