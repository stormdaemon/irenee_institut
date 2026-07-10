const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const controlCharacters = /[\u0000-\u001f\u007f]/;

export class RequestSecurityError extends Error {
  readonly status = 403;

  constructor(message = "Origine de requête refusée.") {
    super(message);
    this.name = "RequestSecurityError";
  }
}

function repeatedlyDecode(value: string) {
  let decoded = value;
  for (let index = 0; index < 2; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return "";
    }
  }
  return decoded;
}

export function safeInternalPath(value: unknown, fallback = "/") {
  if (typeof value !== "string") return fallback;
  const candidate = value.trim();
  const decoded = repeatedlyDecode(candidate);
  if (
    !candidate ||
    !decoded ||
    controlCharacters.test(candidate) ||
    controlCharacters.test(decoded) ||
    candidate.includes("\\") ||
    decoded.includes("\\") ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    decoded.startsWith("//")
  ) {
    return fallback;
  }

  try {
    const origin = "https://irenee-institut.invalid";
    const parsed = new URL(candidate, origin);
    if (parsed.origin !== origin || !parsed.pathname.startsWith("/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function assertSameOrigin(request: Request) {
  if (!unsafeMethods.has(request.method.toUpperCase())) return;

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") throw new RequestSecurityError();

  const origin = request.headers.get("origin");
  if (!origin) throw new RequestSecurityError("Origine de requête manquante.");

  let suppliedOrigin: string;
  try {
    const parsedOrigin = new URL(origin);
    if (!["http:", "https:"].includes(parsedOrigin.protocol) || origin !== parsedOrigin.origin) {
      throw new RequestSecurityError();
    }
    suppliedOrigin = parsedOrigin.origin;
  } catch {
    throw new RequestSecurityError();
  }

  const expectedOrigins = new Set<string>();
  try {
    expectedOrigins.add(new URL(request.url).origin);
  } catch {
    throw new RequestSecurityError();
  }

  // Nginx terminates TLS and overwrites these headers before forwarding to the
  // loopback-only Next.js service. Accept that external origin only when every
  // proxy-controlled value is present and internally consistent.
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim().toLowerCase() || "";
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim() || "";
  const requestHost = request.headers.get("host")?.trim() || "";
  if (
    validIp(request.headers.get("x-real-ip"))
    && ["http", "https"].includes(forwardedProto)
    && forwardedHost
    && requestHost.toLowerCase() === forwardedHost.toLowerCase()
    && !controlCharacters.test(forwardedHost)
    && !/[,@\\/]/.test(forwardedHost)
  ) {
    try {
      const forwardedOrigin = new URL(`${forwardedProto}://${forwardedHost}`);
      if (!forwardedOrigin.username && !forwardedOrigin.password && forwardedOrigin.pathname === "/") {
        expectedOrigins.add(forwardedOrigin.origin);
      }
    } catch {
      // A malformed forwarded host is never trusted.
    }
  }

  if (!expectedOrigins.has(suppliedOrigin)) throw new RequestSecurityError();
}

function validIp(value: string | null) {
  const candidate = value?.trim() || "";
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(candidate)) {
    return candidate.split(".").every(part => Number(part) <= 255) ? candidate : "";
  }
  return /^[0-9a-f:]+$/i.test(candidate) && candidate.includes(":") ? candidate : "";
}

export function getTrustedClientIp(request: Request) {
  const realIp = validIp(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for")
    ?.split(",")
    .map(part => validIp(part))
    .filter(Boolean) || [];
  return forwarded.at(-1) || "unknown";
}

export function parseRequestCookies(request: Request) {
  const cookies = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    if (!name || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) continue;
    try {
      cookies.set(name, decodeURIComponent(rawValue));
    } catch {
      // Ignore malformed cookie encoding instead of partially authenticating it.
    }
  }
  return cookies;
}
