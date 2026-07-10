type ModuleWithId = {
  id: string;
};

export function getSafeCourseAssetUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > 4_096 || candidate.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(candidate)) return null;
  try {
    const decoded = decodeURIComponent(candidate);
    if (decoded.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(decoded)) return null;
  } catch {
    return null;
  }

  if (candidate.startsWith("/")) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password) return parsed.toString();
    if (
      process.env.NODE_ENV !== "production" &&
      parsed.protocol === "http:" &&
      !parsed.username &&
      !parsed.password &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]")
    ) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function getSafeCourseMediaUrl(value: unknown) {
  const safeUrl = getSafeCourseAssetUrl(value);
  if (!safeUrl || safeUrl.startsWith("/")) return safeUrl;
  try {
    const parsed = new URL(safeUrl);
    if (parsed.protocol === "http:") return safeUrl;
    const cloudName = String(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "da52mpv3g").trim();
    return parsed.hostname === "res.cloudinary.com" && parsed.pathname.startsWith(`/${cloudName}/`) ? safeUrl : null;
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
