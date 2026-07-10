export type ReaderFontScale = "small" | "normal" | "large";
export type ReaderMeasure = "focused" | "comfortable";

export type ReaderPreferences = {
  fontScale: ReaderFontScale;
  measure: ReaderMeasure;
};

export const defaultReaderPreferences: ReaderPreferences = {
  fontScale: "normal",
  measure: "comfortable",
};

type JourneyModule = {
  id: string;
  titre?: string;
  [key: string]: unknown;
};

type JourneyProgress = {
  complete?: boolean | null;
  module_id: string;
  progression?: number | null;
};

export type CourseJourneyModule<T extends JourneyModule> = {
  module: T;
  progress: number;
  state: "available" | "complete" | "current" | "locked";
};

type CourseJourneyOptions = {
  unlockAll?: boolean;
};

function normalizedProgress(progress?: JourneyProgress) {
  if (progress?.complete) return 100;
  const value = Number(progress?.progression || 0);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

export function buildCourseJourney<T extends JourneyModule>(
  modules: readonly T[],
  progressRows: readonly JourneyProgress[],
  options: CourseJourneyOptions = {},
) {
  const progressByModule = new Map(progressRows.map(progress => [progress.module_id, progress]));
  const values = modules.map(module => normalizedProgress(progressByModule.get(module.id)));
  const completed = modules.map(module => progressByModule.get(module.id)?.complete === true);
  const firstIncompleteIndex = completed.findIndex(value => !value);
  const currentIndex = firstIncompleteIndex < 0 && modules.length ? modules.length - 1 : firstIncompleteIndex;
  const completedCount = completed.filter(Boolean).length;
  const overallProgress = modules.length
    ? Math.round(values.reduce((total, value) => total + value, 0) / modules.length)
    : 0;
  const journeyModules: CourseJourneyModule<T>[] = modules.map((module, index) => ({
    module,
    progress: values[index] || 0,
    state: completed[index]
      ? "complete"
      : index === currentIndex
        ? "current"
        : options.unlockAll
          ? "available"
          : "locked",
  }));
  const resumeModule = currentIndex >= 0 ? modules[currentIndex] || null : null;
  const resumeLabel = !resumeModule
    ? "Aucun module disponible"
    : firstIncompleteIndex < 0
      ? `Revoir le module ${currentIndex + 1}`
      : values[currentIndex] > 0
        ? `Reprendre le module ${currentIndex + 1}`
        : `Commencer le module ${currentIndex + 1}`;

  return {
    completedCount,
    currentIndex,
    firstIncompleteIndex,
    modules: journeyModules,
    overallProgress,
    resumeLabel,
    resumeModule,
  };
}

export function parseReaderPreferences(raw: string | null): ReaderPreferences {
  if (!raw || raw.length > 1_000) return defaultReaderPreferences;
  try {
    const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
    return {
      fontScale: parsed.fontScale === "small" || parsed.fontScale === "large" || parsed.fontScale === "normal"
        ? parsed.fontScale
        : defaultReaderPreferences.fontScale,
      measure: parsed.measure === "focused" || parsed.measure === "comfortable"
        ? parsed.measure
        : defaultReaderPreferences.measure,
    };
  } catch {
    return defaultReaderPreferences;
  }
}
