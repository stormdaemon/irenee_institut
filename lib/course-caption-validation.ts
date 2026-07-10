import { open, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { CourseInputError, sanitizeCourseMediaUrl, type ParsedCourseModule } from "./course-input";

const DEFAULT_MAX_VTT_BYTES = 512 * 1024;
const DEFAULT_RESOURCE_TIMEOUT_MS = 4_000;
const DEFAULT_GLOBAL_TIMEOUT_MS = 8_000;
const DEFAULT_CONCURRENCY = 3;

type PublishedCourseInput = {
  course: { statut: string };
  modules: Array<Pick<ParsedCourseModule, "url_sous_titres">>;
};

export type CaptionValidationOptions = {
  concurrency?: number;
  fetchImpl?: typeof fetch;
  globalTimeoutMs?: number;
  maxBytes?: number;
  publicRoot?: string;
  resourceTimeoutMs?: number;
};

function resourceError(moduleIndex: number, detail: string) {
  return new CourseInputError(`Les sous-titres du module ${moduleIndex + 1} n'ont pas pu être vérifiés : ${detail}`);
}

function isBelow(root: string, candidate: string) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot !== "" && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !pathFromRoot.startsWith(sep);
}

function parseTimestamp(value: string) {
  const match = /^(?:(\d+):)?([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(value);
  if (!match) return null;
  return (((Number(match[1] || 0) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1_000) + Number(match[4]);
}

function isWebVtt(bytes: Uint8Array) {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return false;
  }
  if (source.includes("\0")) return false;
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  if (!/^WEBVTT(?:[ \t].*)?$/.test(lines[0] || "")) return false;

  for (let index = 1; index < lines.length; index += 1) {
    const timing = lines[index]?.trim() || "";
    const separator = timing.indexOf("-->");
    if (separator < 0) continue;
    const start = parseTimestamp(timing.slice(0, separator).trim());
    const end = parseTimestamp(timing.slice(separator + 3).trim().split(/[ \t]/, 1)[0] || "");
    if (start === null || end === null || end <= start) continue;
    for (let payloadIndex = index + 1; payloadIndex < lines.length && lines[payloadIndex]?.trim(); payloadIndex += 1) {
      if (lines[payloadIndex]?.trim()) return true;
    }
  }
  return false;
}

async function readBoundedLocalFile(url: string, publicRoot: string, maxBytes: number, moduleIndex: number) {
  let decodedPath: string;
  try {
    const rawPath = url.split(/[?#]/, 1)[0] || "";
    decodedPath = decodeURIComponent(rawPath);
    const segments = decodedPath.split("/");
    if (!decodedPath.startsWith("/") || decodedPath.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(decodedPath)
      || segments.some(segment => segment === "." || segment === "..")) {
      throw new Error("unsafe path");
    }
  } catch {
    throw resourceError(moduleIndex, "le chemin local est invalide.");
  }

  let canonicalRoot: string;
  let canonicalFile: string;
  try {
    canonicalRoot = await realpath(/* turbopackIgnore: true */ publicRoot);
    const candidate = resolve(/* turbopackIgnore: true */ canonicalRoot, `.${decodedPath}`);
    if (!isBelow(canonicalRoot, candidate)) throw new Error("outside public");
    canonicalFile = await realpath(/* turbopackIgnore: true */ candidate);
    if (!isBelow(canonicalRoot, canonicalFile)) throw new Error("symlink outside public");
  } catch {
    throw resourceError(moduleIndex, "le chemin local est invalide ou le fichier n'existe pas.");
  }

  const handle = await open(/* turbopackIgnore: true */ canonicalFile, "r").catch(() => null);
  if (!handle) throw resourceError(moduleIndex, "le fichier local ne peut pas être lu.");
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw resourceError(moduleIndex, "le chemin local ne désigne pas un fichier.");
    if (stats.size > maxBytes) throw resourceError(moduleIndex, "le fichier WebVTT est trop volumineux.");
    const target = new Uint8Array(maxBytes + 1);
    let offset = 0;
    while (offset < target.byteLength) {
      const { bytesRead } = await handle.read(target, offset, target.byteLength - offset, null);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > maxBytes) throw resourceError(moduleIndex, "le fichier WebVTT est trop volumineux.");
    return target.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

async function readBoundedResponse(response: Response, maxBytes: number, moduleIndex: number) {
  if (!response.ok) throw resourceError(moduleIndex, "la ressource distante est indisponible.");
  const mime = (response.headers.get("content-type") || "").split(";", 1)[0]?.trim().toLowerCase();
  if (mime !== "text/vtt") throw resourceError(moduleIndex, "la ressource doit être servie avec le type MIME text/vtt.");
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    throw resourceError(moduleIndex, "le fichier WebVTT est trop volumineux.");
  }
  if (!response.body) throw resourceError(moduleIndex, "la ressource distante est vide.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw resourceError(moduleIndex, "le fichier WebVTT est trop volumineux.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function readRemoteFile(
  url: string,
  maxBytes: number,
  moduleIndex: number,
  fetchImpl: typeof fetch,
  globalSignal: AbortSignal,
  resourceTimeoutMs: number,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, resourceTimeoutMs);
  globalSignal.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "text/vtt" },
      redirect: "error",
      signal: controller.signal,
    });
    return await readBoundedResponse(response, maxBytes, moduleIndex);
  } catch (error) {
    if (error instanceof CourseInputError) throw error;
    throw resourceError(moduleIndex, controller.signal.aborted ? "la vérification a expiré." : "la ressource distante est indisponible.");
  } finally {
    clearTimeout(timer);
    globalSignal.removeEventListener("abort", abort);
  }
}

async function validateResource(
  url: string,
  moduleIndex: number,
  options: Required<Pick<CaptionValidationOptions, "fetchImpl" | "maxBytes" | "publicRoot" | "resourceTimeoutMs">>,
  globalSignal: AbortSignal,
) {
  const safeUrl = sanitizeCourseMediaUrl(url);
  if (!safeUrl) throw resourceError(moduleIndex, "l'adresse n'est pas contrôlée par l'Institut.");
  const bytes = safeUrl.startsWith("/")
    ? await readBoundedLocalFile(safeUrl, options.publicRoot, options.maxBytes, moduleIndex)
    : await readRemoteFile(safeUrl, options.maxBytes, moduleIndex, options.fetchImpl, globalSignal, options.resourceTimeoutMs);
  if (!isWebVtt(bytes)) throw resourceError(moduleIndex, "la ressource ne contient pas un contenu WebVTT valide avec au moins un sous-titre.");
}

export async function validatePublishedCaptionResources(input: PublishedCourseInput, options: CaptionValidationOptions = {}) {
  if (input.course.statut !== "publie") return;
  const uniqueResources = new Map<string, number>();
  input.modules.forEach((module, moduleIndex) => {
    const url = String(module.url_sous_titres || "").trim();
    if (url && !uniqueResources.has(url)) uniqueResources.set(url, moduleIndex);
  });
  if (!uniqueResources.size) return;

  const settings = {
    concurrency: Math.max(1, Math.min(5, Math.trunc(options.concurrency ?? DEFAULT_CONCURRENCY))),
    fetchImpl: options.fetchImpl ?? fetch,
    globalTimeoutMs: Math.max(100, options.globalTimeoutMs ?? DEFAULT_GLOBAL_TIMEOUT_MS),
    maxBytes: Math.max(64, options.maxBytes ?? DEFAULT_MAX_VTT_BYTES),
    publicRoot: options.publicRoot ?? resolve(/* turbopackIgnore: true */ process.cwd(), "public"),
    resourceTimeoutMs: Math.max(100, options.resourceTimeoutMs ?? DEFAULT_RESOURCE_TIMEOUT_MS),
  };
  const queue = [...uniqueResources.entries()];
  const controller = new AbortController();
  const globalTimer = setTimeout(() => controller.abort(), settings.globalTimeoutMs);
  let cursor = 0;
  let firstError: unknown;
  const worker = async () => {
    while (!firstError && !controller.signal.aborted) {
      const item = queue[cursor];
      cursor += 1;
      if (!item) return;
      try {
        await validateResource(item[0], item[1], settings, controller.signal);
      } catch (error) {
        if (!firstError) firstError = error;
        controller.abort();
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(settings.concurrency, queue.length) }, worker));
    if (firstError) throw firstError;
    if (controller.signal.aborted) throw new CourseInputError("La vérification des sous-titres a expiré. Réessayez avant de publier.");
  } finally {
    clearTimeout(globalTimer);
  }
}
