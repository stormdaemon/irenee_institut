"use client";

import type { Course, CourseModule } from "@/lib/types";
import { Check, ChevronDown, FileText, GripVertical, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";
import { RichHtmlEditor } from "@/components/RichHtmlEditor";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export type ModuleDraft = {
  id?: string;
  clientId: string;
  titre: string;
  description: string;
  contenu_html: string;
  url_video: string;
  duree: number;
  type_contenu: string;
  ordre: number;
};

export type CourseDraft = {
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

const emptyModule = (ordre = 1, clientId = `local-module-${ordre}`): ModuleDraft => ({
  clientId,
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
  modules: [],
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
    clientId: `saved-module-${module.id}`,
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
    modules: course.modules?.length ? course.modules.map(moduleFromDb) : [],
  };
}

function cleanList(values: string[]) {
  return values.map(value => value.trim()).filter(Boolean);
}

export type CourseDraftIssue = {
  field: "course-title" | "course-slug" | "course-description" | "module-title";
  message: string;
  moduleIndex?: number;
};

export function serializeCourseModules(modules: ModuleDraft[]) {
  return modules.map((module, index) => ({
    ...(module.id ? { id: module.id } : {}),
    titre: module.titre,
    description: module.description,
    contenu_html: module.contenu_html,
    url_video: module.url_video,
    duree: module.duree,
    type_contenu: module.type_contenu,
    ordre: index + 1,
  }));
}

export function courseDraftSignature(draft: CourseDraft) {
  return JSON.stringify({
    ...draft,
    objectifs: [...draft.objectifs],
    competences: [...draft.competences],
    prerequis: [...draft.prerequis],
    modules: serializeCourseModules(draft.modules),
  });
}

export function validateCourseDraft(draft: CourseDraft): CourseDraftIssue[] {
  const issues: CourseDraftIssue[] = [];
  if (!draft.titre.trim()) issues.push({ field: "course-title", message: "Donnez un titre au cours." });
  if (!draft.slug.trim()) issues.push({ field: "course-slug", message: "Donnez une adresse URL au cours." });
  if (!draft.description.trim()) issues.push({ field: "course-description", message: "Ajoutez une description courte au cours." });
  draft.modules.forEach((module, moduleIndex) => {
    if (!module.titre.trim()) {
      issues.push({ field: "module-title", message: `Donnez un titre au module ${moduleIndex + 1}.`, moduleIndex });
    }
  });
  return issues;
}

function courseFromSaveResponse(value: unknown, fallback: CourseDraft): Course | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = String(record.id || fallback.id || "");
  if (!id) return null;
  const rawModules = Array.isArray(record.modules)
    ? record.modules
    : Array.isArray(record.course_modules)
      ? record.course_modules
      : [];
  const fallbackPrice = Math.round(Number(fallback.prix.replace(",", ".") || 0) * 100);
  const fallbackReducedPrice = Math.round(Number(fallback.prix_reduit.replace(",", ".") || 0) * 100);

  return {
    id,
    titre: String(record.titre ?? fallback.titre),
    slug: String(record.slug ?? fallback.slug),
    description: String(record.description ?? fallback.description),
    image_url: String(record.image_url ?? fallback.image_url) || null,
    niveau: String(record.niveau ?? fallback.niveau),
    statut: String(record.statut ?? fallback.statut),
    semestre: Number(record.semestre ?? fallback.semestre),
    numero: Number(record.numero ?? fallback.numero),
    prix: Number(record.prix ?? fallbackPrice),
    prix_reduit: Number(record.prix_reduit ?? fallbackReducedPrice),
    duree_totale: Number(record.duree_totale_minutes ?? record.duree_totale ?? fallback.duree_totale_minutes),
    duree_totale_minutes: Number(record.duree_totale_minutes ?? fallback.duree_totale_minutes),
    nb_modules: Number(record.nb_modules || rawModules.length),
    url_paiement_paypal: String(record.url_paiement_paypal ?? fallback.url_paiement_paypal) || null,
    objectifs: Array.isArray(record.objectifs) ? record.objectifs.map(String) : cleanList(fallback.objectifs),
    competences: Array.isArray(record.competences) ? record.competences.map(String) : cleanList(fallback.competences),
    prerequis: Array.isArray(record.prerequis) ? record.prerequis.map(String) : cleanList(fallback.prerequis),
    modules: rawModules.map((module, index) => ({
      ...(module as CourseModule),
      id: String((module as CourseModule).id || ""),
      titre: String((module as CourseModule).titre || `Module ${index + 1}`),
      description: String((module as CourseModule).description || ""),
      duree: Number((module as CourseModule).duree || 0),
      type: String((module as CourseModule).type_contenu || (module as CourseModule).type || "texte"),
    })),
  };
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [draft, setDraft] = useState<CourseDraft>(emptyDraft);
  const [savedDraft, setSavedDraft] = useState<CourseDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [draggedModule, setDraggedModule] = useState<number | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [validationIssue, setValidationIssue] = useState<CourseDraftIssue | null>(null);
  const initialCourseQueryHandled = useRef(false);
  const localModuleSequence = useRef(0);
  const selectedCourse = useMemo(() => courses.find(course => course.id === draft.id), [courses, draft.id]);
  const isDirty = useMemo(() => courseDraftSignature(draft) !== courseDraftSignature(savedDraft), [draft, savedDraft]);

  useEffect(() => {
    void refreshCourses();
  }, []);

  useEffect(() => {
    if (initialCourseQueryHandled.current || coursesLoading) return;
    initialCourseQueryHandled.current = true;
    const requestedCourse = new URLSearchParams(window.location.search).get("course");
    if (!requestedCourse) return;

    const course = courses.find(item => item.id === requestedCourse || item.slug === requestedCourse);
    if (course) selectCourse(course, { confirmDiscard: false, updateUrl: false, shouldScroll: false });
  }, [courses, coursesLoading]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmLinkNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const href = target.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const nextUrl = new URL(target.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return;
      if (!saving && window.confirm("Abandonner les modifications non enregistrées ?")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [isDirty, saving]);

  useEffect(() => {
    if (isDirty && status === "success") setStatus("idle");
  }, [isDirty, status]);

  async function refreshCourses() {
    setCoursesLoading(true);
    try {
      const response = await authenticatedFetch("/api/courses");
      const next = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(next)) {
        const message = next && typeof next === "object" && "error" in next ? String(next.error) : "Les cours n'ont pas pu être chargés.";
        throw new Error(message);
      }
      setCourses(next as Course[]);
      return next as Course[];
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Les cours n'ont pas pu être chargés.");
      setStatus("error");
      return null;
    } finally {
      setCoursesLoading(false);
    }
  }

  function markEdited() {
    if (status === "success") setStatus("idle");
    if (validationIssue) setValidationIssue(null);
  }

  function update<K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) {
    markEdited();
    setDraft(current => ({ ...current, [key]: value }));
  }

  function updateList(key: "objectifs" | "competences" | "prerequis", index: number, value: string) {
    markEdited();
    setDraft(current => ({ ...current, [key]: current[key].map((item, i) => i === index ? value : item) }));
  }

  function addListItem(key: "objectifs" | "competences" | "prerequis") {
    if (saving) return;
    markEdited();
    setDraft(current => ({ ...current, [key]: [...current[key], ""] }));
  }

  function removeListItem(key: "objectifs" | "competences" | "prerequis", index: number) {
    if (saving) return;
    markEdited();
    setDraft(current => {
      const next = current[key].filter((_, i) => i !== index);
      return { ...current, [key]: next.length ? next : [""] };
    });
  }

  function updateModule(index: number, patch: Partial<ModuleDraft>) {
    markEdited();
    setDraft(current => ({
      ...current,
      modules: current.modules.map((module, i) => i === index ? { ...module, ...patch } : module),
    }));
  }

  function addModule() {
    if (saving) return;
    markEdited();
    const clientId = `local-module-${Date.now()}-${localModuleSequence.current++}`;
    setDraft(current => ({ ...current, modules: [...current.modules, emptyModule(current.modules.length + 1, clientId)] }));
    setExpandedModuleId(clientId);
  }

  function removeModule(index: number) {
    if (saving) return;
    const module = draft.modules[index];
    if (!module || !window.confirm(`Supprimer ${module.titre.trim() ? `« ${module.titre.trim()} »` : `le module ${index + 1}`} ? Cette action sera appliquée au prochain enregistrement.`)) return;
    markEdited();
    const next = draft.modules.filter((_, i) => i !== index).map((item, i) => ({ ...item, ordre: i + 1 }));
    setDraft(current => ({ ...current, modules: next }));
    if (expandedModuleId === module.clientId) setExpandedModuleId(next[index]?.clientId || next[index - 1]?.clientId || null);
  }

  function moveModule(from: number, to: number) {
    if (saving || from === to || from < 0 || to < 0 || from >= draft.modules.length || to >= draft.modules.length) return;
    markEdited();
    setDraft(current => {
      const next = [...current.modules];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...current, modules: next.map((module, index) => ({ ...module, ordre: index + 1 })) };
    });
  }

  function replaceCourseQuery(course: Course | null) {
    const url = new URL(window.location.href);
    if (course) url.searchParams.set("course", course.id);
    else url.searchParams.delete("course");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function confirmDiscardChanges() {
    return !isDirty || window.confirm("Abandonner les modifications non enregistrées ?");
  }

  function selectCourse(course: Course, options: { confirmDiscard?: boolean; updateUrl?: boolean; shouldScroll?: boolean } = {}) {
    if (saving) return;
    const { confirmDiscard = true, updateUrl = true, shouldScroll = true } = options;
    if (confirmDiscard && !confirmDiscardChanges()) return;
    const nextDraft = draftFromCourse(course);
    setDraft(nextDraft);
    setSavedDraft(nextDraft);
    setExpandedModuleId(nextDraft.modules[0]?.clientId || null);
    setStatus("idle");
    setError("");
    setValidationIssue(null);
    if (updateUrl) replaceCourseQuery(course);
    if (shouldScroll) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newCourse() {
    if (saving || !confirmDiscardChanges()) return;
    const nextDraft = emptyDraft();
    setDraft(nextDraft);
    setSavedDraft(nextDraft);
    setExpandedModuleId(null);
    setStatus("idle");
    setError("");
    setValidationIssue(null);
    replaceCourseQuery(null);
  }

  function cancelChanges() {
    if (saving || !confirmDiscardChanges()) return;
    setDraft(savedDraft);
    setExpandedModuleId(savedDraft.modules[0]?.clientId || null);
    setStatus("idle");
    setError("");
    setValidationIssue(null);
  }

  function toggleModule(clientId: string) {
    if (saving) return;
    setExpandedModuleId(current => current === clientId ? null : clientId);
  }

  function focusIssue(issue: CourseDraftIssue, issueDraft: CourseDraft) {
    if (issue.field === "module-title" && issue.moduleIndex !== undefined) {
      const module = issueDraft.modules[issue.moduleIndex];
      if (module) setExpandedModuleId(module.clientId);
    }
    window.setTimeout(() => {
      const id = issue.field === "module-title" && issue.moduleIndex !== undefined
        ? `module-${issueDraft.modules[issue.moduleIndex]?.clientId}-title`
        : issue.field;
      document.getElementById(id)?.focus();
    }, 0);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const submittedDraft = { ...draft, slug: draft.slug || slugify(draft.titre) };
    const issues = validateCourseDraft(submittedDraft);
    if (issues.length) {
      setDraft(submittedDraft);
      setError(issues[0].message);
      setValidationIssue(issues[0]);
      setStatus("error");
      focusIssue(issues[0], submittedDraft);
      return;
    }

    setSaving(true);
    setStatus("saving");
    setError("");
    setValidationIssue(null);

    const form = new FormData();
    form.set("titre", submittedDraft.titre);
    form.set("slug", submittedDraft.slug);
    form.set("description", submittedDraft.description);
    form.set("image_url", submittedDraft.image_url);
    form.set("niveau", submittedDraft.niveau);
    form.set("statut", submittedDraft.statut);
    form.set("semestre", String(submittedDraft.semestre || 1));
    form.set("numero", String(submittedDraft.numero || 0));
    form.set("prix", submittedDraft.prix.replace(",", "."));
    form.set("prix_reduit", submittedDraft.prix_reduit.replace(",", "."));
    form.set("duree_totale_minutes", String(submittedDraft.duree_totale_minutes || 0));
    form.set("url_paiement_paypal", submittedDraft.url_paiement_paypal);
    form.set("objectifs", JSON.stringify(cleanList(submittedDraft.objectifs)));
    form.set("competences", JSON.stringify(cleanList(submittedDraft.competences)));
    form.set("prerequis", JSON.stringify(cleanList(submittedDraft.prerequis)));
    const serializedModules = serializeCourseModules(submittedDraft.modules);
    form.set("modules", JSON.stringify(serializedModules));
    form.set("nb_modules", String(serializedModules.length));

    try {
      const url = submittedDraft.id ? `/api/courses/${submittedDraft.id}` : "/api/courses";
      const response = await authenticatedFetch(url, { method: submittedDraft.id ? "PATCH" : "POST", body: form });
      const data = await response.json().catch(() => null) as { verified?: boolean; data?: unknown; error?: string } | null;
      if (!response.ok || data?.verified !== true) {
        throw new Error(data?.error || "Le cours n'a pas pu être enregistré.");
      }
      const savedCourse = courseFromSaveResponse(data.data, submittedDraft);
      if (!savedCourse) throw new Error("Le serveur n'a pas renvoyé le cours enregistré.");
      const nextDraft = draftFromCourse(savedCourse);
      setCourses(current => [...current.filter(course => course.id !== savedCourse.id), savedCourse]
        .sort((first, second) => Number(first.numero || 0) - Number(second.numero || 0)));
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setExpandedModuleId(nextDraft.modules[0]?.clientId || null);
      replaceCourseQuery(savedCourse);
      setStatus("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le cours n'a pas pu être enregistré.");
      setStatus("error");
    } finally {
      setSaving(false);
    }
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
          <button className="btn btn-primary" type="button" onClick={newCourse} disabled={saving}>
            <Plus size={18} aria-hidden="true" /> Nouveau cours
          </button>
        </div>

        <div id="course-editor-notice">
          <ActionNotice status={status} success="Cours enregistré." error={error} />
        </div>

        <div className="course-admin-layout">
          <form className="course-editor card" onSubmit={submit} noValidate aria-busy={saving}>
            <fieldset className="course-editor-fields" disabled={saving}>
              <div className="course-editor-head">
                <div>
                  <span className="badge">{draft.id ? "Modification" : "Création"}</span>
                  <h2 className="font-display">{draft.id ? draft.titre || "Cours sélectionné" : "Nouveau cours"}</h2>
                </div>
                <div className="course-editor-state" aria-live="polite">
                  {isDirty ? <span className="editor-dirty-dot">Modifications non enregistrées</span> : <span>À jour</span>}
                  {selectedCourse && <small>{selectedCourse.modules?.length || 0} module(s)</small>}
                </div>
              </div>

              <section className="editor-panel" aria-labelledby="course-information-heading">
                <div className="editor-panel-heading">
                  <div>
                    <h3 id="course-information-heading">Informations du cours</h3>
                    <p>Le titre, l'adresse et le résumé visibles par les étudiants.</p>
                  </div>
                </div>
                <div className="grid-2">
                  <p><label htmlFor="course-title">Titre du cours *</label><input id="course-title" className="input" value={draft.titre} aria-invalid={validationIssue?.field === "course-title"} aria-describedby={validationIssue?.field === "course-title" ? "course-editor-notice" : undefined} onChange={event => update("titre", event.target.value)} onBlur={() => !draft.slug && update("slug", slugify(draft.titre))} /></p>
                  <p><label htmlFor="course-slug">Slug URL *</label><input id="course-slug" className="input" value={draft.slug} aria-invalid={validationIssue?.field === "course-slug"} aria-describedby={validationIssue?.field === "course-slug" ? "course-editor-notice" : undefined} onChange={event => update("slug", slugify(event.target.value))} autoCapitalize="none" spellCheck={false} /></p>
                </div>
                <p><label htmlFor="course-description">Description courte *</label><textarea id="course-description" className="input" rows={4} value={draft.description} aria-invalid={validationIssue?.field === "course-description"} aria-describedby={validationIssue?.field === "course-description" ? "course-editor-notice" : undefined} onChange={event => update("description", event.target.value)} /></p>
                <p><label htmlFor="course-image">Image de couverture</label><input id="course-image" className="input" type="url" value={draft.image_url} onChange={event => update("image_url", event.target.value)} placeholder="https://… ou /images/…" inputMode="url" /></p>
              </section>

              <section className="editor-panel" aria-labelledby="course-settings-heading">
                <div className="editor-panel-heading">
                  <div>
                    <h3 id="course-settings-heading">Publication et organisation</h3>
                    <p>Réglez la visibilité, l'ordre, le niveau et les informations tarifaires.</p>
                  </div>
                </div>
                <div className="grid-4">
                  <p><label htmlFor="course-status">Statut</label><select id="course-status" className="input" value={draft.statut} onChange={event => update("statut", event.target.value)}><option value="brouillon">Brouillon</option><option value="en_preparation">En préparation</option><option value="publie">Publié</option><option value="archive">Archivé</option></select></p>
                  <p><label htmlFor="course-level">Niveau</label><select id="course-level" className="input" value={draft.niveau} onChange={event => update("niveau", event.target.value)}><option value="debutant">Débutant</option><option value="intermediaire">Intermédiaire</option><option value="avance">Avancé</option></select></p>
                  <p><label htmlFor="course-semester">Semestre</label><input id="course-semester" className="input" type="number" min={1} value={draft.semestre} onChange={event => update("semestre", Number(event.target.value))} /></p>
                  <p><label htmlFor="course-order">Ordre</label><input id="course-order" className="input" type="number" min={0} value={draft.numero} onChange={event => update("numero", Number(event.target.value))} /></p>
                </div>
                <div className="grid-3">
                  <p><label htmlFor="course-price">Prix normal (€)</label><input id="course-price" className="input" inputMode="decimal" value={draft.prix} onChange={event => update("prix", event.target.value)} /></p>
                  <p><label htmlFor="course-reduced-price">Prix réduit (€)</label><input id="course-reduced-price" className="input" inputMode="decimal" value={draft.prix_reduit} onChange={event => update("prix_reduit", event.target.value)} /></p>
                  <p><label htmlFor="course-duration">Durée totale (min)</label><input id="course-duration" className="input" type="number" min={0} value={draft.duree_totale_minutes} onChange={event => update("duree_totale_minutes", Number(event.target.value))} /></p>
                </div>
                <p><label htmlFor="course-payment-url">URL de paiement</label><input id="course-payment-url" className="input" type="url" inputMode="url" value={draft.url_paiement_paypal} onChange={event => update("url_paiement_paypal", event.target.value)} placeholder="https://…" /></p>
              </section>

              <section className="editor-panel" aria-labelledby="course-teaching-heading">
                <div className="editor-panel-heading">
                  <div>
                    <h3 id="course-teaching-heading">Repères pédagogiques</h3>
                    <p>Présentez clairement ce que l'étudiant va apprendre et mobiliser.</p>
                  </div>
                </div>
                <CourseListEditor idPrefix="course-objective" title="Objectifs pédagogiques" values={draft.objectifs} onAdd={() => addListItem("objectifs")} onChange={(index, value) => updateList("objectifs", index, value)} onRemove={index => removeListItem("objectifs", index)} />
                <CourseListEditor idPrefix="course-skill" title="Compétences" values={draft.competences} onAdd={() => addListItem("competences")} onChange={(index, value) => updateList("competences", index, value)} onRemove={index => removeListItem("competences", index)} />
                <CourseListEditor idPrefix="course-prerequisite" title="Prérequis" values={draft.prerequis} onAdd={() => addListItem("prerequis")} onChange={(index, value) => updateList("prerequis", index, value)} onRemove={index => removeListItem("prerequis", index)} />
              </section>

              <section className="editor-panel module-panel" aria-labelledby="course-modules-heading">
                <div className="module-editor-head">
                  <div>
                    <h3 id="course-modules-heading">Modules du cours</h3>
                    <p>{draft.modules.length ? `${draft.modules.length} module${draft.modules.length > 1 ? "s" : ""} — ouvrez uniquement celui que vous souhaitez modifier.` : "Ajoutez votre premier module quand le cours est prêt."}</p>
                  </div>
                  <button type="button" className="btn btn-outline" onClick={addModule}><Plus size={16} aria-hidden="true" /> Ajouter un module</button>
                </div>
                {!draft.modules.length && (
                  <div className="module-empty-state">
                    <FileText size={24} aria-hidden="true" />
                    <p>Ce cours ne contient encore aucun module.</p>
                    <button type="button" className="btn btn-outline" onClick={addModule}><Plus size={16} aria-hidden="true" /> Créer le premier module</button>
                  </div>
                )}
                {draft.modules.map((module, index) => {
                  const moduleBaseId = `module-${module.clientId}`;
                  const expanded = expandedModuleId === module.clientId;
                  return (
                    <article
                      className={`module-editor ${expanded ? "is-expanded" : ""}`}
                      key={module.clientId}
                      aria-labelledby={`${moduleBaseId}-toggle`}
                      onDragOver={event => event.preventDefault()}
                      onDrop={() => {
                        if (draggedModule !== null) moveModule(draggedModule, index);
                        setDraggedModule(null);
                      }}
                      onDragEnd={() => setDraggedModule(null)}
                    >
                      <div className="module-editor-summary">
                        <span
                          className="badge module-drag-handle"
                          draggable={!saving}
                          onDragStart={() => setDraggedModule(index)}
                          title="Déplacer le module"
                        >
                          <GripVertical size={16} aria-hidden="true" /> {index + 1}
                        </span>
                        <button
                          id={`${moduleBaseId}-toggle`}
                          type="button"
                          className="module-editor-toggle"
                          aria-expanded={expanded}
                          aria-controls={`${moduleBaseId}-body`}
                          onClick={() => toggleModule(module.clientId)}
                        >
                          <span>
                            <strong>{module.titre.trim() || `Module ${index + 1} sans titre`}</strong>
                            <small>{module.type_contenu || "texte"} · {module.duree || 0} min</small>
                          </span>
                          <ChevronDown className={expanded ? "rotate" : ""} size={20} aria-hidden="true" />
                        </button>
                        <div className="module-editor-actions" role="group" aria-label={`Actions du module ${index + 1}`}>
                          <button type="button" className="icon-button" aria-label={`Monter le module ${index + 1}`} onClick={() => moveModule(index, index - 1)} disabled={index === 0}>↑</button>
                          <button type="button" className="icon-button" aria-label={`Descendre le module ${index + 1}`} onClick={() => moveModule(index, index + 1)} disabled={index === draft.modules.length - 1}>↓</button>
                          <button type="button" className="icon-button danger" aria-label={`Supprimer le module ${index + 1}`} onClick={() => removeModule(index)}><Trash2 size={18} aria-hidden="true" /></button>
                        </div>
                      </div>
                      {expanded && (
                        <div id={`${moduleBaseId}-body`} className="module-editor-body">
                          <div className="grid-2">
                            <p><label htmlFor={`${moduleBaseId}-title`}>Titre du module *</label><input id={`${moduleBaseId}-title`} className="input" value={module.titre} aria-invalid={validationIssue?.field === "module-title" && validationIssue.moduleIndex === index} aria-describedby={validationIssue?.field === "module-title" && validationIssue.moduleIndex === index ? "course-editor-notice" : undefined} onChange={event => updateModule(index, { titre: event.target.value })} /></p>
                            <p><label htmlFor={`${moduleBaseId}-type`}>Type de contenu</label><select id={`${moduleBaseId}-type`} className="input" value={module.type_contenu} onChange={event => updateModule(index, { type_contenu: event.target.value })}><option value="texte">Texte</option><option value="video">Vidéo</option><option value="quiz">Quiz</option></select></p>
                          </div>
                          <p><label htmlFor={`${moduleBaseId}-description`}>Description</label><textarea id={`${moduleBaseId}-description`} className="input" rows={2} value={module.description} onChange={event => updateModule(index, { description: event.target.value })} /></p>
                          <div className="grid-2">
                            <p><label htmlFor={`${moduleBaseId}-duration`}>Durée (min)</label><input id={`${moduleBaseId}-duration`} className="input" type="number" min={0} value={module.duree} onChange={event => updateModule(index, { duree: Number(event.target.value) })} /></p>
                            <p><label htmlFor={`${moduleBaseId}-video`}>URL vidéo</label><input id={`${moduleBaseId}-video`} className="input" type="url" inputMode="url" value={module.url_video} onChange={event => updateModule(index, { url_video: event.target.value })} placeholder="https://…" /></p>
                          </div>
                          <div className="module-content-field">
                            <label id={`${moduleBaseId}-content-label`}>Contenu du module</label>
                            <RichHtmlEditor id={`${moduleBaseId}-content`} label={`Contenu du module ${index + 1}`} value={module.contenu_html} disabled={saving} onChange={value => updateModule(index, { contenu_html: value })} />
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>

              <div className="editor-actions editor-save-bar">
                <div className="editor-save-copy" aria-live="polite">
                  <strong>{saving ? "Enregistrement en cours…" : isDirty ? "Modifications à enregistrer" : "Toutes les modifications sont enregistrées"}</strong>
                  <small>{isDirty ? "Vos changements restent protégés si vous tentez de quitter cette page." : "Vous pouvez changer de cours en toute sécurité."}</small>
                </div>
                <div className="editor-save-buttons">
                  <button className="btn btn-primary" disabled={saving || !isDirty}><Save size={18} aria-hidden="true" /> {saving ? "Enregistrement…" : draft.id ? "Enregistrer" : "Créer le cours"}</button>
                  <button className="btn btn-outline" type="button" onClick={cancelChanges} disabled={saving || !isDirty}><X size={18} aria-hidden="true" /> Annuler</button>
                </div>
              </div>
            </fieldset>
          </form>

          <aside className="course-list-panel" aria-labelledby="course-list-heading">
            <h2 id="course-list-heading" className="font-display">Cours existants</h2>
            <div className="course-list">
              {coursesLoading && (
                <div className="course-list-loading">
                  <Loader2 className="action-spin" size={22} aria-hidden="true" />
                  <span>Chargement des cours...</span>
                </div>
              )}
              {!coursesLoading && courses.map(course => (
                <button className={`course-list-item ${course.id === draft.id ? "active" : ""}`} key={course.id} type="button" onClick={() => selectCourse(course)} disabled={saving} aria-current={course.id === draft.id ? "true" : undefined}>
                  <span className="course-list-title"><FileText size={18} aria-hidden="true" /> {course.titre}</span>
                  <span className="muted">{course.modules?.length || course.nb_modules || 0} modules · {course.statut || "brouillon"}</span>
                  {course.id === draft.id && <Check size={18} aria-hidden="true" />}
                </button>
              ))}
              {!coursesLoading && !courses.length && (
                <div className="course-list-loading">
                  <FileText size={22} aria-hidden="true" />
                  <span>Aucun cours pour le moment.</span>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function CourseListEditor({ idPrefix, title, values, onAdd, onChange, onRemove }: {
  idPrefix: string;
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
        <button type="button" className="btn btn-outline" aria-label={`Ajouter ${title.toLowerCase()}`} onClick={onAdd}><Plus size={16} aria-hidden="true" /> Ajouter</button>
      </div>
      {values.map((item, index) => (
        <div className="list-row" key={index}>
          <div className="list-row-field">
            <label htmlFor={`${idPrefix}-${index}`}>{title} {index + 1}</label>
            <input id={`${idPrefix}-${index}`} className="input" value={item} onChange={event => onChange(index, event.target.value)} />
          </div>
          <button type="button" className="icon-button" onClick={() => onRemove(index)} aria-label={`Supprimer ${title.toLowerCase()} ${index + 1}`}><Trash2 size={16} aria-hidden="true" /></button>
        </div>
      ))}
    </div>
  );
}
