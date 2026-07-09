type ModuleWithId = {
  id: string;
};

export function getSafeCourseAssetUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.startsWith("//")) return null;

  if (candidate.startsWith("/") && !candidate.startsWith("/\\")) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:") return candidate;
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]")
    ) {
      return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

export function getModuleNavigation<T extends ModuleWithId>(modules: T[], moduleId: string) {
  const currentIndex = modules.findIndex(module => module.id === moduleId);
  if (currentIndex < 0) {
    return {
      currentIndex,
      position: 0,
      total: modules.length,
      previousModule: null,
      nextModule: null
    };
  }

  return {
    currentIndex,
    position: currentIndex + 1,
    total: modules.length,
    previousModule: modules[currentIndex - 1] || null,
    nextModule: modules[currentIndex + 1] || null
  };
}
