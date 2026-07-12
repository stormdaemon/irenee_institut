const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+(). -]*$/;
const forbiddenTextCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const contactSubjects = new Set(["Formation", "Paiement", "Technique"]);

export type ContactInput = {
  email: string;
  message: string;
  nom: string;
  prenom: string;
  sujet: "Formation" | "Paiement" | "Technique";
  telephone: string;
  website: string;
};

export class ContactInputError extends Error {
  readonly status = 400;

  constructor(message = "Message de contact invalide.") {
    super(message);
    this.name = "ContactInputError";
  }
}

function requiredText(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string") throw new ContactInputError(`${label} est requis.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || forbiddenTextCharacters.test(normalized)) {
    throw new ContactInputError(`${label} est invalide.`);
  }
  return normalized;
}

function optionalText(value: unknown, maximum: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ContactInputError();
  const normalized = value.trim();
  if (normalized.length > maximum || forbiddenTextCharacters.test(normalized)) throw new ContactInputError();
  return normalized;
}

function requiredSingleLineText(value: unknown, label: string, maximum: number) {
  const normalized = requiredText(value, label, maximum);
  if (/[\r\n]/.test(normalized)) throw new ContactInputError(`${label} est invalide.`);
  return normalized;
}

export function parseContactInput(value: unknown): ContactInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContactInputError();
  const input = value as Record<string, unknown>;
  const prenom = requiredSingleLineText(input.prenom, "Le prénom", 80);
  const nom = requiredSingleLineText(input.nom, "Le nom", 80);
  const email = requiredSingleLineText(input.email, "L’adresse email", 254).toLowerCase();
  const telephone = optionalText(input.telephone, 32);
  const sujet = requiredSingleLineText(input.sujet, "Le sujet", 32);
  const message = requiredText(input.message, "Le message", 4_000);
  const website = optionalText(input.website, 200);

  if (!emailPattern.test(email)) throw new ContactInputError("L’adresse email est invalide.");
  if (telephone && !phonePattern.test(telephone)) throw new ContactInputError("Le téléphone est invalide.");
  if (!contactSubjects.has(sujet)) throw new ContactInputError("Le sujet est invalide.");
  if (message.length < 20) throw new ContactInputError("Le message doit contenir au moins 20 caractères.");

  return {
    email,
    message,
    nom,
    prenom,
    sujet: sujet as ContactInput["sujet"],
    telephone,
    website
  };
}
