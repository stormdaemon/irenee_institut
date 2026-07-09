export const EXAM_ATTEMPT_COOLDOWN_MS = 15 * 60 * 1000;
export const EXAM_MAX_ATTEMPTS_PER_DAY = 5;
export const MINIMUM_MODULE_ENGAGEMENT_MS = 30 * 1000;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CompletionInput = Record<string, unknown>;

type ExamQuestion = {
  answer: number;
  id: string;
  options: readonly unknown[];
};

type ModuleQuizQuestion = {
  answer?: unknown;
  id?: unknown;
  options?: unknown;
};

export function parseModuleCompletion(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Requête de progression invalide.");
  }

  const input = value as CompletionInput;
  const courseId = typeof input.course_id === "string" ? input.course_id.trim() : "";
  const moduleId = typeof input.module_id === "string" ? input.module_id.trim() : "";

  if (!uuidPattern.test(courseId)) throw new Error("course_id invalide.");
  if (!uuidPattern.test(moduleId)) throw new Error("module_id invalide.");
  if (input.complete !== true) throw new Error("Seule la transition vers un module terminé est autorisée.");
  if (input.progression !== undefined && (!Number.isInteger(input.progression) || input.progression !== 100)) {
    throw new Error("La progression de fin de module doit être exactement 100.");
  }
  if (input.statut !== undefined && input.statut !== "termine") {
    throw new Error("Le statut de progression est géré par le serveur.");
  }
  if (input.score_quiz !== undefined && input.score_quiz !== null) {
    throw new Error("Le score du quiz ne peut pas être fourni par le client.");
  }

  return { courseId, moduleId };
}

export function parseModuleStart(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Requête de progression invalide.");
  }
  const input = value as CompletionInput;
  const courseId = typeof input.course_id === "string" ? input.course_id.trim() : "";
  const moduleId = typeof input.module_id === "string" ? input.module_id.trim() : "";
  if (!uuidPattern.test(courseId)) throw new Error("course_id invalide.");
  if (!uuidPattern.test(moduleId)) throw new Error("module_id invalide.");
  if (input.action !== "start") throw new Error("Action de progression invalide.");
  if (input.complete !== undefined || input.progression !== undefined || input.score_quiz !== undefined) {
    throw new Error("Les données de progression sont gérées par le serveur.");
  }
  return { courseId, moduleId };
}

export function evaluateModuleCompletionGate(input: {
  alreadyComplete?: boolean;
  completedModuleIds: Iterable<string>;
  moduleId: string;
  now?: number;
  orderedModuleIds: readonly string[];
  startedAt?: string | null;
}) {
  if (input.alreadyComplete) return { allowed: true as const };
  const index = input.orderedModuleIds.indexOf(input.moduleId);
  if (index < 0) return { allowed: false as const, reason: "unknown_module" as const };
  const completed = new Set(input.completedModuleIds);
  if (input.orderedModuleIds.slice(0, index).some(id => !completed.has(id))) {
    return { allowed: false as const, reason: "previous_module" as const };
  }
  const startedAt = input.startedAt ? Date.parse(input.startedAt) : Number.NaN;
  if (!Number.isFinite(startedAt)) return { allowed: false as const, reason: "not_started" as const };
  const remaining = MINIMUM_MODULE_ENGAGEMENT_MS - ((input.now ?? Date.now()) - startedAt);
  if (remaining > 0) {
    return {
      allowed: false as const,
      reason: "engagement_time" as const,
      retryAfterSeconds: Math.max(1, Math.ceil(remaining / 1000))
    };
  }
  return { allowed: true as const };
}

export function hasPublishedCourseAccess(input: {
  activeAnnualPass: boolean;
  activeEnrollment: boolean;
  isStaff: boolean;
  published: boolean;
}) {
  return input.published && (input.isStaff || input.activeAnnualPass || input.activeEnrollment);
}

export function isActiveCourseEnrollment(input: {
  accessExpiresAt?: string | null;
  accessSource?: string | null;
  activeAnnualPass: boolean;
  now?: number;
  status?: string | null;
}) {
  if (input.status !== "en_cours") return false;
  const source = input.accessSource || "legacy";
  if (source === "legacy" || source === "payment") return true;
  if (source !== "annual_pass" || !input.activeAnnualPass || !input.accessExpiresAt) return false;
  const expiresAt = Date.parse(input.accessExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt > (input.now ?? Date.now());
}

export function normalizeFinalExamAnswers(value: unknown, questions: readonly ExamQuestion[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Répondez à toutes les questions.");
  }

  const submitted = value as Record<string, unknown>;
  const normalized: Record<string, number> = {};
  for (const question of questions) {
    const answer = submitted[question.id];
    if (!Number.isInteger(answer) || Number(answer) < 0 || Number(answer) >= question.options.length) {
      if (answer === undefined) throw new Error("Répondez à toutes les questions.");
      throw new Error(`Réponse invalide pour la question ${question.id}.`);
    }
    normalized[question.id] = Number(answer);
  }
  return normalized;
}

export function evaluateModuleQuizAnswers(value: unknown, quiz: unknown) {
  if (!Array.isArray(quiz) || quiz.length < 1 || quiz.length > 100) {
    throw new Error("Ce quiz n'est pas correctement configuré.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Répondez à toutes les questions du quiz.");
  }
  const submitted = value as Record<string, unknown>;
  let correct = 0;
  for (const [index, entry] of quiz.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Ce quiz n'est pas correctement configuré.");
    }
    const question = entry as ModuleQuizQuestion;
    const id = String(question.id || `question-${index + 1}`).slice(0, 100);
    const options = Array.isArray(question.options) ? question.options : [];
    const expected = Number(question.answer);
    const answer = submitted[id];
    if (!Number.isInteger(expected) || expected < 0 || expected >= options.length) {
      throw new Error("Ce quiz n'est pas correctement configuré.");
    }
    if (!Number.isInteger(answer) || Number(answer) < 0 || Number(answer) >= options.length) {
      throw new Error("Répondez à toutes les questions du quiz.");
    }
    if (Number(answer) === expected) correct += 1;
  }
  const score = Math.round((correct / quiz.length) * 100);
  return { passed: score >= 80, score };
}

export function evaluateExamAttemptWindow(input: {
  attemptsLastDay: number;
  latestAttemptAt: string | null;
  now?: number;
}): { allowed: true } | { allowed: false; reason: "cooldown" | "daily_limit"; retryAfterSeconds: number } {
  const now = input.now ?? Date.now();
  if (input.attemptsLastDay >= EXAM_MAX_ATTEMPTS_PER_DAY) {
    return {
      allowed: false,
      reason: "daily_limit",
      retryAfterSeconds: 24 * 60 * 60
    };
  }

  const latestAttemptAt = input.latestAttemptAt ? Date.parse(input.latestAttemptAt) : Number.NaN;
  if (Number.isFinite(latestAttemptAt)) {
    const remaining = EXAM_ATTEMPT_COOLDOWN_MS - (now - latestAttemptAt);
    if (remaining > 0) {
      return {
        allowed: false,
        reason: "cooldown",
        retryAfterSeconds: Math.max(1, Math.ceil(remaining / 1000))
      };
    }
  }

  return { allowed: true };
}
