import { ANNUAL_PASS_NAME } from "@/lib/curriculum";

export type LearningDocumentKind = "module_parchment" | "course_parchment" | "final_certificate";

export type LearningDocument = {
  id: string;
  document_number: string;
  document_kind: LearningDocumentKind;
  recipient_name: string;
  course_title?: string | null;
  module_title?: string | null;
  issued_at: string;
};

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function learningDocumentIssuedAt(document: LearningDocument) {
  const value = document.issued_at;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(value));
}

export function learningDocumentTitle(document: LearningDocument) {
  if (document.document_kind === "final_certificate") return "Certificat nominatif d'apologétique";
  if (document.document_kind === "course_parchment") return "Parchemin de connaissance";
  return "Parchemin de connaissance";
}

export function learningDocumentAchievement(document: LearningDocument) {
  if (document.document_kind === "final_certificate") {
    return "a achevé le cursus annuel et réussi l'examen final d'apologétique";
  }
  if (document.document_kind === "course_parchment") {
    return `a suivi et validé l'ensemble du cours « ${document.course_title || "Cours d'apologétique"} »`;
  }
  return `a suivi et validé le module « ${document.module_title || "Module d'apologétique"} »`;
}

export function learningDocumentFilename(document: LearningDocument) {
  const kind = document.document_kind === "final_certificate" ? "certificat-apologetique" : "parchemin-connaissance";
  return `${kind}-${document.document_number.toLowerCase()}.pdf`;
}

export function renderLearningDocumentSvg(document: LearningDocument) {
  const recipient = escapeXml(document.recipient_name);
  const title = escapeXml(learningDocumentTitle(document));
  const achievement = escapeXml(learningDocumentAchievement(document));
  const issuedAt = escapeXml(learningDocumentIssuedAt(document));
  const number = escapeXml(document.document_number);
  const passName = escapeXml(ANNUAL_PASS_NAME);
  const isCertificate = document.document_kind === "final_certificate";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1131" viewBox="0 0 1600 1131" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">Document nominatif délivré à ${recipient}</desc>
  <defs>
    <radialGradient id="paper" cx="50%" cy="42%" r="78%">
      <stop offset="0%" stop-color="#fff9e8"/>
      <stop offset="72%" stop-color="#f2dfb1"/>
      <stop offset="100%" stop-color="#d2ad68"/>
    </radialGradient>
    <linearGradient id="ink" x1="0%" x2="100%">
      <stop offset="0%" stop-color="#102b53"/>
      <stop offset="100%" stop-color="#06162e"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#07172d" flood-opacity=".28"/>
    </filter>
  </defs>
  <rect width="1600" height="1131" fill="#071b37"/>
  <rect x="48" y="48" width="1504" height="1035" rx="14" fill="url(#paper)" filter="url(#shadow)"/>
  <rect x="78" y="78" width="1444" height="975" rx="8" fill="none" stroke="#b08438" stroke-width="5"/>
  <rect x="99" y="99" width="1402" height="933" rx="4" fill="none" stroke="#1b3d69" stroke-width="2"/>
  <path d="M126 176H1474M126 955H1474" stroke="#b08438" stroke-width="2"/>
  <circle cx="800" cy="192" r="78" fill="#0b2a55" stroke="#bd9142" stroke-width="8"/>
  <circle cx="800" cy="192" r="58" fill="none" stroke="#efd58e" stroke-width="2"/>
  <text x="800" y="177" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#efd58e">IHS</text>
  <text x="800" y="216" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="#efd58e">INSTITUT SAINT IRÉNÉE</text>
  <text x="800" y="325" text-anchor="middle" font-family="Georgia,serif" font-size="30" letter-spacing="7" fill="#9b6e28">INSTITUT D'APOLOGÉTIQUE SAINT IRÉNÉE</text>
  <text x="800" y="406" text-anchor="middle" font-family="Georgia,serif" font-size="${isCertificate ? 68 : 62}" font-weight="700" fill="url(#ink)">${title}</text>
  <text x="800" y="485" text-anchor="middle" font-family="Georgia,serif" font-size="28" fill="#704e22">est décerné à</text>
  <text x="800" y="575" text-anchor="middle" font-family="Georgia,serif" font-size="72" font-style="italic" fill="#102b53">${recipient}</text>
  <path d="M420 610H1180" stroke="#b08438" stroke-width="3"/>
  <text x="800" y="684" text-anchor="middle" font-family="Georgia,serif" font-size="30" fill="#38270f">${achievement}</text>
  <text x="800" y="744" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="#6a4a1f">${passName}</text>
  <text x="800" y="830" text-anchor="middle" font-family="Georgia,serif" font-size="24" fill="#38270f">Délivré le ${issuedAt}</text>
  <text x="800" y="866" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" fill="#62451e">Document pédagogique automatisé — identité déclarée par le titulaire, non vérifiée par l'Institut</text>
  <text x="800" y="892" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" fill="#62451e">Vérification : irenee-institut.org/verifier-document — Référence ${number}</text>
  <text x="264" y="939" text-anchor="middle" font-family="Georgia,serif" font-size="19" fill="#62451e">Direction de l'Institut</text>
  <path d="M145 906H383" stroke="#6d4d21" stroke-width="2"/>
  <text x="1336" y="939" text-anchor="middle" font-family="Georgia,serif" font-size="19" fill="#62451e">Référence ${number}</text>
  <path d="M1217 906H1455" stroke="#6d4d21" stroke-width="2"/>
  <circle cx="800" cy="944" r="53" fill="#8f2025" opacity=".94"/>
  <circle cx="800" cy="944" r="39" fill="none" stroke="#d89563" stroke-width="2"/>
  <text x="800" y="938" text-anchor="middle" font-family="Georgia,serif" font-size="17" fill="#f6d4a2">SAINT</text>
  <text x="800" y="962" text-anchor="middle" font-family="Georgia,serif" font-size="17" fill="#f6d4a2">IRÉNÉE</text>
</svg>`;
}
