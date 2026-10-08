import { utf8ByteLength } from "./course-editor-workspace";

export type QuizQuestionDraft = {
  id: string;
  question: string;
  options: string[];
  answer: number;
};

export type ModuleDraft = {
  id?: string;
  clientId: string;
  titre: string;
  description: string;
  contenu_html: string;
  url_video: string;
  url_sous_titres: string;
  duree: number;
  type_contenu: string;
  ordre: number;
  quiz?: QuizQuestionDraft[];
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
  updated_at?: string;
};


export function duplicateCourseModuleDraft(module: ModuleDraft, clientId: string, ordre: number): ModuleDraft {
  const { id: _savedModuleId, ...authoredModule } = module;
  const safeClientId = clientId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 72) || "local-module-copy";
  const title = module.titre.trim();
  const copySuffix = " — copie";
  return {
    ...authoredModule,
    clientId: safeClientId,
    ordre,
    titre: title ? `${title.slice(0, 240 - copySuffix.length).trimEnd()}${copySuffix}` : "",
    quiz: module.quiz?.map((question, questionIndex) => ({
      ...question,
      id: `quiz-${safeClientId}-copy-${questionIndex + 1}`.slice(0, 100),
      options: [...question.options],
    })),
  };
}


export type CourseDraftIssue = {
  field: "course-title" | "course-slug" | "course-description" | "module-title" | "module-captions";
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
    url_sous_titres: module.url_sous_titres,
    duree: module.duree,
    type_contenu: module.type_contenu,
    ordre: index + 1,
    quiz: (module.quiz || []).map(question => ({
      id: question.id,
      question: question.question,
      options: [...question.options],
      answer: question.answer,
    })),
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
    if (draft.statut === "publie" && module.url_video.trim() && !(module.url_sous_titres || "").trim()) {
      issues.push({ field: "module-captions", message: `Ajoutez les sous-titres WebVTT du module ${moduleIndex + 1} avant publication.`, moduleIndex });
    }
    if (utf8ByteLength((module.url_sous_titres || "").trim()) > 4_096) {
      issues.push({ field: "module-captions", message: `L’adresse des sous-titres du module ${moduleIndex + 1} dépasse 4 096 octets.`, moduleIndex });
    }
  });
  return issues;
}

export function courseStatusForSave(currentStatus: string, savedStatus: string, explicitPublication: boolean) {
  if (explicitPublication) return "publie";
  if (currentStatus === "publie" && savedStatus !== "publie") return null;
  return currentStatus;
}

export function draftAfterFailedCourseSave(originalDraft: CourseDraft, submittedDraft: CourseDraft, explicitPublication: boolean) {
  return explicitPublication ? { ...submittedDraft, statut: originalDraft.statut } : submittedDraft;
}
