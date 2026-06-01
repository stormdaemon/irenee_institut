export const LIBRARY_MEMBERSHIP_AMOUNT_CENTS = 1500;
export const LIBRARY_MEMBERSHIP_NAME = "Adhesion annuelle a la bibliotheque d'ecole apologetique";
export const LIBRARY_MEMBERSHIP_PRODUCT_ID = "apologetics-school-library";
export const LIBRARY_MEMBERSHIP_SLUG = "bibliotheque-ecole-apologetique";
export const LIBRARY_MEMBERSHIP_DURATION_DAYS = 365;
export const LIBRARY_BOOK_TITLE_MAX_LENGTH = 180;

export function normalizeLibraryBookTitle(value: unknown) {
  const title = String(value || "").trim().replace(/\s+/g, " ");
  if (!title) throw new Error("Indiquez le titre du livre souhaite.");
  return title.slice(0, LIBRARY_BOOK_TITLE_MAX_LENGTH);
}
