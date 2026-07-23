export type PublishedCourseRow = {
  slug: string;
  titre?: string | null;
  semestre?: number | null;
  numero?: number | null;
};

export type NextCourseLink = {
  slug: string;
  titre: string;
};

// Courses are studied in a fixed pedagogical order (semestre, then numero).
// Given every published course and the current slug, return the next course to
// study, or null when the student has reached the final published course.
export function resolveNextPublishedCourse(
  rows: readonly PublishedCourseRow[] | null | undefined,
  currentSlug: string,
): NextCourseLink | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const ordered = [...rows].sort((a, b) =>
    (Number(a.semestre ?? 99) - Number(b.semestre ?? 99))
    || (Number(a.numero ?? 999) - Number(b.numero ?? 999))
    || String(a.titre ?? "").localeCompare(String(b.titre ?? "")));
  const index = ordered.findIndex(row => row.slug === currentSlug);
  if (index < 0 || index + 1 >= ordered.length) return null;
  const next = ordered[index + 1];
  if (!next?.slug) return null;
  return { slug: String(next.slug), titre: String(next.titre ?? "") };
}
