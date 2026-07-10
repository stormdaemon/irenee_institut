import sanitizeHtml from "sanitize-html";
import { sanitizeCourseClassAttribute, sanitizeCourseStyleAttribute } from "./course-html-style";

const MAX_HTML_LENGTH = 1_000_000;
const MAX_MODULES = 100;
const MAX_QUIZ_QUESTIONS = 100;
const MAX_QUIZ_OPTIONS = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QUIZ_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,99})$/i;
const COURSE_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,6}Z$/;
const RESERVED_QUIZ_IDS = new Set(["__proto__", "constructor", "prototype"]);
const courseStatuses = new Set(["brouillon", "en_preparation", "publie", "archive"]);
const courseLevels = new Set(["debutant", "intermediaire", "avance"]);
const moduleTypes = new Set(["texte", "video", "quiz"]);

export class CourseInputError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "CourseInputError";
  }
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) throw new CourseInputError(`${label} est requis.`);
  if (normalized.length > maxLength) throw new CourseInputError(`${label} est trop long.`);
  return normalized;
}

function optionalText(value: unknown, label: string, maxLength: number) {
  const normalized = String(value || "").trim();
  if (normalized.length > maxLength) throw new CourseInputError(`${label} est trop long.`);
  return normalized;
}

function boundedInteger(value: unknown, label: string, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new CourseInputError(`${label} est invalide.`);
  }
  return number;
}

function parseMoney(value: unknown, label: string) {
  const normalized = String(value || "0").trim().replace(",", ".");
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalized)) throw new CourseInputError(`${label} est invalide.`);
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100_000_000) {
    throw new CourseInputError(`${label} est invalide.`);
  }
  return cents;
}

function parseArray(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string") throw new CourseInputError(`${label} est invalide.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new CourseInputError(`${label} contient un JSON invalide.`);
  }
  if (!Array.isArray(parsed)) throw new CourseInputError(`${label} doit être une liste.`);
  return parsed;
}

function parseTextList(value: FormDataEntryValue | null, label: string) {
  const parsed = parseArray(value ?? "[]", label);
  if (parsed.length > 100) throw new CourseInputError(`${label} contient trop d'éléments.`);
  return parsed.map((item, index) => optionalText(item, `${label} ${index + 1}`, 500)).filter(Boolean);
}

function parseExpectedUpdatedAt(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") return null;
  if (typeof value !== "string") throw new CourseInputError("La version du cours est invalide.");
  const candidate = value.trim();
  if (candidate.length > 100 || !COURSE_VERSION_PATTERN.test(candidate)) {
    throw new CourseInputError("La version du cours est invalide.");
  }
  const timestamp = Date.parse(candidate);
  if (!Number.isFinite(timestamp)) throw new CourseInputError("La version du cours est invalide.");
  return candidate;
}

export type ParsedCourseQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  answer?: number;
};

function normalizedQuizText(value: unknown, label: string, maxLength: number) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length > maxLength) throw new CourseInputError(`${label} est trop long.`);
  return normalized;
}

function parseModuleQuiz(value: unknown, moduleIndex: number): ParsedCourseQuizQuestion[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new CourseInputError(`Le quiz du module ${moduleIndex + 1} doit être une liste de questions.`);
  if (value.length > MAX_QUIZ_QUESTIONS) {
    throw new CourseInputError(`Le quiz du module ${moduleIndex + 1} contient trop de questions.`);
  }

  const identifiers = new Set<string>();
  return value.map((rawQuestion, questionIndex) => {
    if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) {
      throw new CourseInputError(`La question ${questionIndex + 1} du quiz est invalide.`);
    }
    const entry = rawQuestion as Record<string, unknown>;
    const id = requiredText(entry.id, `L'identifiant de la question ${questionIndex + 1}`, 100);
    if (!QUIZ_ID_PATTERN.test(id) || RESERVED_QUIZ_IDS.has(id.toLowerCase())) {
      throw new CourseInputError(`L'identifiant de la question ${questionIndex + 1} est invalide.`);
    }
    if (identifiers.has(id)) throw new CourseInputError(`L'identifiant de la question ${questionIndex + 1} est déjà utilisé.`);
    identifiers.add(id);

    const question = normalizedQuizText(entry.question, `La question ${questionIndex + 1}`, 1_000);
    const rawOptions = entry.options ?? [];
    if (!Array.isArray(rawOptions) || rawOptions.length > MAX_QUIZ_OPTIONS) {
      throw new CourseInputError(`Les réponses de la question ${questionIndex + 1} sont invalides.`);
    }
    const options = rawOptions.map((option, optionIndex) => normalizedQuizText(
      option,
      `La réponse ${optionIndex + 1} de la question ${questionIndex + 1}`,
      500,
    ));
    let answer: number | undefined;
    if (entry.answer !== undefined && entry.answer !== null && entry.answer !== "") {
      answer = boundedInteger(entry.answer, `La correction de la question ${questionIndex + 1}`, 0, MAX_QUIZ_OPTIONS - 1);
    }
    return { id, options, question, ...(answer !== undefined ? { answer } : {}) };
  });
}

function courseHtmlHasText(html: string) {
  return sanitizeHtml(html, { allowedAttributes: {}, allowedTags: [] })
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim().length > 0;
}

function validatePublishedCourse(
  modules: ParsedCourseModule[],
  objectifs: string[],
  competences: string[],
) {
  if (!modules.length) throw new CourseInputError("Pour publier ce cours, ajoutez au moins un module.");
  if (!objectifs.length || !competences.length) {
    throw new CourseInputError("Pour publier ce cours, ajoutez au moins un objectif et une compétence.");
  }
  modules.forEach((module, index) => {
    if (module.url_video && !module.url_sous_titres) {
      throw new CourseInputError(`Le module vidéo ${index + 1} doit inclure un fichier WebVTT de sous-titres avant publication.`);
    }
    if (module.type_contenu === "quiz") {
      if (!module.quiz?.length) {
        throw new CourseInputError(`Le quiz du module ${index + 1} doit contenir au moins une question avant publication.`);
      }
      module.quiz.forEach((question, questionIndex) => {
        if (!question.question.trim()) {
          throw new CourseInputError(`La question ${questionIndex + 1} du quiz du module ${index + 1} doit avoir un intitulé avant publication.`);
        }
        if (question.options.length < 2 || question.options.some(option => !option.trim())) {
          throw new CourseInputError(`La question ${questionIndex + 1} du quiz du module ${index + 1} doit proposer au moins deux réponses complètes.`);
        }
        if (new Set(question.options).size !== question.options.length) {
          throw new CourseInputError(`Les réponses de la question ${questionIndex + 1} du quiz doivent être différentes.`);
        }
        if (!Number.isInteger(question.answer) || Number(question.answer) < 0 || Number(question.answer) >= question.options.length) {
          throw new CourseInputError(`La question ${questionIndex + 1} du quiz doit avoir une correction valide avant publication.`);
        }
      });
      return;
    }
    const hasText = courseHtmlHasText(module.contenu_html);
    if (module.type_contenu === "video") {
      if (!hasText && !module.url_video) {
        throw new CourseInputError(`Le module vidéo ${index + 1} doit contenir un texte ou une URL HTTPS avant publication.`);
      }
      return;
    }
    if (!hasText) throw new CourseInputError(`Le module ${index + 1} doit contenir du texte avant publication.`);
  });
}

export function sanitizeExternalUrl(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  if (/[\u0000-\u001f\u007f\\]/.test(candidate) || candidate.startsWith("//")) return "";

  if (candidate.startsWith("/")) {
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded.startsWith("//") || decoded.includes("\\")) return "";
      return candidate;
    } catch {
      return "";
    }
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function sanitizeCourseMediaUrl(value: unknown) {
  const safeUrl = sanitizeExternalUrl(value);
  if (!safeUrl || safeUrl.startsWith("/")) return safeUrl;
  try {
    const url = new URL(safeUrl);
    const cloudName = String(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "da52mpv3g").trim();
    return url.hostname === "res.cloudinary.com" && url.pathname.startsWith(`/${cloudName}/`) ? safeUrl : "";
  } catch {
    return "";
  }
}

function sanitizeCourseLinkUrl(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate || candidate.length > 2_048 || /[\u0000-\u001f\u007f\\]/.test(candidate) || candidate.startsWith("//")) return "";
  try {
    const decoded = decodeURIComponent(candidate);
    if (/[\u0000-\u001f\u007f\\]/.test(decoded) || decoded.startsWith("//")) return "";
  } catch {
    return "";
  }
  if (candidate.startsWith("/")) return sanitizeExternalUrl(candidate);
  if (/^(?:mailto:|tel:)/i.test(candidate)) return candidate;
  return sanitizeExternalUrl(candidate);
}

export function sanitizeCourseHtml(value: unknown) {
  const source = String(value || "");
  if (source.length > MAX_HTML_LENGTH) throw new CourseInputError("Le contenu HTML est trop volumineux.");
  const boundedAttributes = (attributes: Record<string, string>) => {
    const next = { ...attributes };
    if (next.style) {
      next.style = sanitizeCourseStyleAttribute(next.style);
      if (!next.style) delete next.style;
    }
    if (next.class) {
      next.class = sanitizeCourseClassAttribute(next.class);
      if (!next.class) delete next.class;
    }
    return next;
  };

  return sanitizeHtml(source, {
    allowedAttributes: {
      "*": ["class", "style"],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"]
    },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["https", "data"],
    },
    allowedStyles: {
      "*": {
        "border": [/^[#(),.%\-\w\s]+$/],
        "border-bottom": [/^[#(),.%\-\w\s]+$/],
        "border-left": [/^[#(),.%\-\w\s]+$/],
        "border-radius": [/^[.\d]+(?:px|rem|em|%)$/],
        "font-style": [/^(?:italic|normal)$/],
        "font-weight": [/^(?:normal|bold|[1-9]00)$/],
        "margin": [/^[.\d\s-]+(?:px|rem|em|%)?(?:\s+[.\d-]+(?:px|rem|em|%)?){0,3}$/],
        "margin-bottom": [/^[.\d-]+(?:px|rem|em|%)$/],
        "margin-top": [/^[.\d-]+(?:px|rem|em|%)$/],
        "padding": [/^[.\d\s-]+(?:px|rem|em|%)?(?:\s+[.\d-]+(?:px|rem|em|%)?){0,3}$/],
        "text-align": [/^(?:left|right|center|justify)$/],
        "text-decoration": [/^(?:none|underline|line-through)$/]
      }
    },
    allowedTags: [
      "a", "b", "blockquote", "br", "code", "details", "div", "em", "figcaption", "figure",
      "h2", "h3", "h4", "hr", "i", "img", "li", "ol", "p", "pre", "section",
      "span", "strong", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u",
      "ul"
    ],
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    nonTextTags: ["script", "style", "textarea", "option"],
    transformTags: {
      "*": (tagName, attributes) => ({ tagName, attribs: boundedAttributes(attributes) }),
      a: (_tagName, attributes) => {
        const bounded = boundedAttributes(attributes);
        const safeHref = sanitizeCourseLinkUrl(bounded.href);
        return {
          tagName: "a",
          attribs: {
            ...(bounded.class ? { class: bounded.class } : {}),
            ...(bounded.style ? { style: bounded.style } : {}),
            ...(safeHref ? { href: safeHref } : {}),
            ...(bounded.title ? { title: bounded.title.slice(0, 300) } : {}),
            ...(bounded.target === "_blank" ? { target: "_blank", rel: "noopener noreferrer" } : {})
          }
        };
      }
    }
  }).trim();
}

export type ParsedCourseModule = {
  id?: string;
  titre: string;
  description: string;
  contenu_html: string;
  contenu: string;
  url_video: string | null;
  url_sous_titres?: string | null;
  duree: number;
  type_contenu: string;
  ordre: number;
  quiz?: ParsedCourseQuizQuestion[];
};

export function parseCourseForm(form: FormData) {
  const title = requiredText(form.get("titre"), "Le titre du cours", 200);
  const slug = requiredText(form.get("slug"), "Le slug", 200).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) throw new CourseInputError("Le slug est invalide.");

  const level = String(form.get("niveau") || "debutant");
  if (!courseLevels.has(level)) throw new CourseInputError("Le niveau est invalide.");
  const status = String(form.get("statut") || "brouillon");
  if (!courseStatuses.has(status)) throw new CourseInputError("Le statut est invalide.");

  const rawModules = parseArray(form.get("modules") ?? "[]", "Les modules");
  if (rawModules.length > MAX_MODULES) throw new CourseInputError("Le cours contient trop de modules.");

  const modules: ParsedCourseModule[] = rawModules.map((rawModule, index) => {
    if (!rawModule || typeof rawModule !== "object" || Array.isArray(rawModule)) {
      throw new CourseInputError(`Le module ${index + 1} est invalide.`);
    }
    const module = rawModule as Record<string, unknown>;
    const id = optionalText(module.id, "L'identifiant du module", 100);
    if (id && !UUID_PATTERN.test(id)) throw new CourseInputError("L'identifiant du module est invalide.");
    const type = String(module.type_contenu || module.type || "texte");
    if (!moduleTypes.has(type)) throw new CourseInputError(`Le type du module ${index + 1} est invalide.`);
    const urlVideo = sanitizeCourseMediaUrl(module.url_video);
    if (module.url_video && !urlVideo) throw new CourseInputError(`L'URL vidéo du module ${index + 1} est invalide. Utilisez un chemin local ou un média Cloudinary.`);
    const hasCaptionsField = Object.hasOwn(module, "url_sous_titres");
    const rawCaptionsUrl = hasCaptionsField
      ? optionalText(module.url_sous_titres, `L'URL de sous-titres du module ${index + 1}`, 4_096)
      : "";
    if (new TextEncoder().encode(rawCaptionsUrl).byteLength > 4_096) {
      throw new CourseInputError(`L'URL de sous-titres du module ${index + 1} est trop longue (4 096 octets maximum).`);
    }
    const captionsUrl = sanitizeCourseMediaUrl(rawCaptionsUrl);
    if (rawCaptionsUrl && !captionsUrl) throw new CourseInputError(`L'URL de sous-titres du module ${index + 1} est invalide. Utilisez un chemin local ou un média Cloudinary.`);
    if (captionsUrl) {
      const path = captionsUrl.startsWith("/")
        ? captionsUrl.split(/[?#]/, 1)[0]
        : new URL(captionsUrl).pathname;
      if (!/\.vtt$/i.test(path)) {
        throw new CourseInputError(`Les sous-titres du module ${index + 1} doivent utiliser un fichier WebVTT (.vtt).`);
      }
    }
    const html = sanitizeCourseHtml(module.contenu_html || module.contenu || "");
    const quiz = parseModuleQuiz(module.quiz, index);
    return {
      ...(id ? { id } : {}),
      titre: requiredText(module.titre, `Le titre du module ${index + 1}`, 240),
      description: optionalText(module.description, `La description du module ${index + 1}`, 2_000),
      contenu_html: html,
      contenu: html,
      url_video: urlVideo || null,
      ...(hasCaptionsField ? { url_sous_titres: captionsUrl || null } : {}),
      duree: boundedInteger(module.duree ?? 0, `La durée du module ${index + 1}`, 0, 100_000),
      type_contenu: type,
      ordre: index + 1,
      ...(quiz !== undefined ? { quiz } : {})
    };
  });

  const imageUrl = sanitizeExternalUrl(form.get("image_url"));
  if (form.get("image_url") && !imageUrl) throw new CourseInputError("L'URL de l'image est invalide.");
  const paymentUrl = sanitizeExternalUrl(form.get("url_paiement_paypal"));
  if (form.get("url_paiement_paypal") && !paymentUrl) throw new CourseInputError("L'URL de paiement est invalide.");

  const duration = boundedInteger(form.get("duree_totale_minutes") || form.get("duree_totale") || 0, "La durée totale", 0, 1_000_000);
  const objectifs = parseTextList(form.get("objectifs") ?? "[]", "Les objectifs");
  const competences = parseTextList(form.get("competences") ?? "[]", "Les compétences");
  const prerequis = parseTextList(form.get("prerequis") ?? "[]", "Les prérequis");
  if (status === "publie") validatePublishedCourse(modules, objectifs, competences);
  return {
    expectedUpdatedAt: parseExpectedUpdatedAt(form.get("expected_updated_at")),
    course: {
      titre: title,
      slug,
      description: requiredText(form.get("description"), "La description", 5_000),
      image_url: imageUrl || null,
      niveau: level,
      objectifs,
      competences,
      prerequis,
      semestre: boundedInteger(form.get("semestre") || 1, "Le semestre", 1, 2),
      numero: boundedInteger(form.get("numero") || 0, "L'ordre du cours", 0, 100_000),
      nb_modules: modules.length,
      duree_totale_minutes: duration,
      duree_totale: duration,
      prix: parseMoney(form.get("prix"), "Le prix"),
      prix_reduit: parseMoney(form.get("prix_reduit"), "Le prix réduit"),
      url_paiement_paypal: paymentUrl || null,
      statut: status
    },
    modules
  };
}
