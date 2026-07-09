export function normalizeDocumentReference(value: unknown) {
  const reference = String(value || "").trim().toUpperCase();
  return /^ISI-[A-Z0-9]{6,20}$/.test(reference) ? reference : "";
}

export function normalizeDeclaredName(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .slice(0, 240);
}

export function matchesDeclaredRecipient(expected: unknown, candidate: unknown) {
  const left = normalizeDeclaredName(expected);
  const right = normalizeDeclaredName(candidate);
  return Boolean(left && right && left === right);
}
