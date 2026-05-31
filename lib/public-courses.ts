import type { Course } from "./types";

export type PublicCourse = Omit<Course, "modules" | "competences" | "prerequis" | "url_paiement_paypal">;

export function toPublicCourse(course: Course): PublicCourse {
  const {
    modules: _modules,
    competences: _competences,
    prerequis: _prerequis,
    url_paiement_paypal: _urlPaiementPayPal,
    ...publicCourse
  } = course;
  return publicCourse;
}
