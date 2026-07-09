const personalFields = new Set([
  "adresse", "bio", "bio_description", "civilite", "code_postal", "date_naissance",
  "formation_academique", "instagram_url", "linkedin_url", "nom", "pays", "prenom",
  "profession", "realisations", "specialites", "telephone", "tiktok_url", "twitter_url", "ville"
]);
const directorFields = new Set([
  "formation_choisie", "modalite_paiement", "moyen_paiement", "statut_inscription", "tarif_applicable"
]);
const socialHosts: Record<string, string[]> = {
  instagram_url: ["instagram.com"],
  linkedin_url: ["linkedin.com"],
  tiktok_url: ["tiktok.com"],
  twitter_url: ["twitter.com", "x.com"]
};
const paymentMethods = new Set(["", "stripe", "paypal", "virement", "cheque", "especes"]);
const paymentSchedules = new Set(["", "1x", "3x", "6x", "annuel"]);
const registrationStatuses = new Set(["en_attente", "validee", "refusee"]);

export class ProfileInputError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "ProfileInputError";
  }
}

function oneLine(value: unknown, label: string, maximum: number, required = false) {
  if (typeof value !== "string") throw new ProfileInputError(`${label} est invalide.`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (required && !normalized) throw new ProfileInputError(`${label} est requis.`);
  if (normalized.length > maximum) throw new ProfileInputError(`${label} est trop long.`);
  return normalized;
}

function multiline(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string") throw new ProfileInputError(`${label} est invalide.`);
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized.length > maximum) throw new ProfileInputError(`${label} est trop long.`);
  return normalized;
}

function textList(value: unknown, label: string, maximumItems = 50) {
  if (!Array.isArray(value) || value.length > maximumItems) throw new ProfileInputError(`${label} est invalide.`);
  return [...new Set(value.map((item, index) => oneLine(item, `${label} ${index + 1}`, 240)).filter(Boolean))];
}

function birthDate(value: unknown) {
  const normalized = oneLine(value, "La date de naissance", 10);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new ProfileInputError("La date de naissance est invalide.");
  const date = new Date(`${normalized}T00:00:00Z`);
  const today = new Date();
  const earliest = new Date("1900-01-01T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== normalized || date > today || date < earliest) {
    throw new ProfileInputError("La date de naissance est invalide.");
  }
  return normalized;
}

function phone(value: unknown) {
  const normalized = oneLine(value, "Le téléphone", 30);
  if (normalized && !/^\+?[0-9 ()\-.]{6,30}$/.test(normalized)) throw new ProfileInputError("Le téléphone est invalide.");
  return normalized;
}

function socialUrl(key: string, value: unknown) {
  const normalized = oneLine(value, "L'adresse du réseau social", 500);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    const hosts = socialHosts[key] || [];
    if (
      url.protocol !== "https:" || url.username || url.password ||
      !hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
    ) {
      throw new Error("unsafe");
    }
    return url.toString();
  } catch {
    throw new ProfileInputError("L'adresse du réseau social est invalide.");
  }
}

function registrationField(key: string, value: unknown) {
  if (key === "formation_choisie") return textList(value, "La formation", 20);
  if (key === "modalite_paiement") {
    const normalized = oneLine(value, "La modalité de paiement", 20);
    if (!paymentSchedules.has(normalized)) throw new ProfileInputError("La modalité de paiement est invalide.");
    return normalized;
  }
  if (key === "moyen_paiement") {
    const normalized = oneLine(value, "Le moyen de paiement", 20);
    if (!paymentMethods.has(normalized)) throw new ProfileInputError("Le moyen de paiement est invalide.");
    return normalized;
  }
  if (key === "statut_inscription") {
    const normalized = oneLine(value, "Le statut d'inscription", 30);
    if (!registrationStatuses.has(normalized)) throw new ProfileInputError("Le statut d'inscription est invalide.");
    return normalized;
  }
  return oneLine(value, "Le tarif", 100);
}

function profileField(key: string, value: unknown) {
  if (key === "date_naissance") return birthDate(value);
  if (key === "telephone") return phone(value);
  if (key === "specialites" || key === "realisations") return textList(value, key === "specialites" ? "Les spécialités" : "Les réalisations");
  if (socialHosts[key]) return socialUrl(key, value);
  if (key === "civilite") {
    const normalized = oneLine(value, "La civilité", 20);
    if (!["", "M.", "Mme"].includes(normalized)) throw new ProfileInputError("La civilité est invalide.");
    return normalized;
  }
  if (key === "bio" || key === "bio_description") return multiline(value, "La biographie", 10_000);
  const limits: Record<string, number> = {
    adresse: 500,
    code_postal: 20,
    formation_academique: 2_000,
    nom: 120,
    pays: 120,
    prenom: 120,
    profession: 240,
    ville: 120
  };
  return oneLine(value, key === "nom" ? "Le nom" : key === "prenom" ? "Le prénom" : "Le champ", limits[key] || 500, key === "nom" || key === "prenom");
}

export function parseProfileUpdate(body: Record<string, unknown>, isDirector: boolean) {
  const allowed = isDirector ? new Set([...personalFields, ...directorFields]) : personalFields;
  const keys = Object.keys(body);
  if (keys.some(key => !allowed.has(key))) throw new ProfileInputError("Un champ de profil n'est pas autorisé.");
  return Object.fromEntries(keys.map(key => [
    key,
    directorFields.has(key) ? registrationField(key, body[key]) : profileField(key, body[key])
  ]));
}

export function parseRegistrationInput(body: Record<string, unknown>) {
  const allowed = new Set(["formation_choisie", "modalite_paiement", "moyen_paiement", "nom", "prenom", "tarif_applicable", "telephone"]);
  const keys = Object.keys(body);
  if (keys.some(key => !allowed.has(key))) throw new ProfileInputError("Un champ d'inscription n'est pas autorisé.");
  return Object.fromEntries(keys.map(key => [
    key,
    directorFields.has(key) ? registrationField(key, body[key]) : profileField(key, body[key])
  ]));
}
