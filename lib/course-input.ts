import sanitizeHtml from "sanitize-html";

const MAX_HTML_LENGTH = 1_000_000;
const MAX_MODULES = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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

export function sanitizeCourseHtml(value: unknown) {
  const source = String(value || "");
  if (source.length > MAX_HTML_LENGTH) throw new CourseInputError("Le contenu HTML est trop volumineux.");

  return sanitizeHtml(source, {
    allowedAttributes: {
      "*": ["class", "style"],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      source: ["src", "type"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      video: ["src", "controls", "preload", "poster", "width", "height"]
    },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["https", "data"],
      source: ["https"],
      video: ["https"]
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
      "h2", "h3", "h4", "hr", "i", "img", "li", "ol", "p", "pre", "section", "source",
      "span", "strong", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u",
      "ul", "video"
    ],
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    nonTextTags: ["script", "style", "textarea", "option"],
    transformTags: {
      a: (_tagName, attributes) => {
        const href = attributes.href || "";
        const safeHref = href.startsWith("/") || /^(?:https:|mailto:|tel:)/i.test(href) ? href : "";
        return {
          tagName: "a",
          attribs: {
            ...(safeHref ? { href: safeHref } : {}),
            ...(attributes.title ? { title: attributes.title.slice(0, 300) } : {}),
            ...(attributes.target === "_blank" ? { target: "_blank", rel: "noopener noreferrer" } : {})
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
  duree: number;
  type_contenu: string;
  ordre: number;
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
    const urlVideo = sanitizeExternalUrl(module.url_video);
    if (module.url_video && !urlVideo) throw new CourseInputError(`L'URL vidéo du module ${index + 1} est invalide.`);
    const html = sanitizeCourseHtml(module.contenu_html || module.contenu || "");
    return {
      ...(id ? { id } : {}),
      titre: requiredText(module.titre, `Le titre du module ${index + 1}`, 240),
      description: optionalText(module.description, `La description du module ${index + 1}`, 2_000),
      contenu_html: html,
      contenu: html,
      url_video: urlVideo || null,
      duree: boundedInteger(module.duree ?? 0, `La durée du module ${index + 1}`, 0, 100_000),
      type_contenu: type,
      ordre: index + 1
    };
  });

  const imageUrl = sanitizeExternalUrl(form.get("image_url"));
  if (form.get("image_url") && !imageUrl) throw new CourseInputError("L'URL de l'image est invalide.");
  const paymentUrl = sanitizeExternalUrl(form.get("url_paiement_paypal"));
  if (form.get("url_paiement_paypal") && !paymentUrl) throw new CourseInputError("L'URL de paiement est invalide.");

  const duration = boundedInteger(form.get("duree_totale_minutes") || form.get("duree_totale") || 0, "La durée totale", 0, 1_000_000);
  return {
    course: {
      titre: title,
      slug,
      description: requiredText(form.get("description"), "La description", 5_000),
      image_url: imageUrl || null,
      niveau: level,
      objectifs: parseTextList(form.get("objectifs") ?? "[]", "Les objectifs"),
      competences: parseTextList(form.get("competences") ?? "[]", "Les compétences"),
      prerequis: parseTextList(form.get("prerequis") ?? "[]", "Les prérequis"),
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
