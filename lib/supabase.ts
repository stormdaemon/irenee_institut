type AuthResponse<T> = {
  data: T;
  error: { message: string } | null;
};

type BrowserSession = {
  access_token: string;
  expires_at: number;
  expires_in: number;
  token_type: "bearer";
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
    identities?: unknown[];
  };
};

import type { LocalServerClient } from "./local-server-client";

const storageKey = "irenee.auth.session";
let syncedAccessToken: string | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function readStoredSession(): BrowserSession | null {
  if (!isBrowser()) return null;
  try {
    const session = JSON.parse(window.localStorage.getItem(storageKey) || "null") as BrowserSession | null;
    if (!session?.access_token || !session.expires_at) return null;
    if (session.expires_at <= Math.floor(Date.now() / 1000)) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function writeStoredSession(session: BrowserSession | null) {
  if (!isBrowser()) return;
  if (session) window.localStorage.setItem(storageKey, JSON.stringify(session));
  else window.localStorage.removeItem(storageKey);
  if (!session) syncedAccessToken = null;
  window.dispatchEvent(new CustomEvent("irenee-auth-change", { detail: session }));
}

async function syncSessionCookie(session: BrowserSession | null) {
  if (!session?.access_token) return false;
  if (syncedAccessToken === session.access_token) return true;

  const response = await fetch("/api/auth/session", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    method: "POST"
  }).catch(() => null);

  if (!response?.ok) {
    writeStoredSession(null);
    return false;
  }

  syncedAccessToken = session.access_token;
  return true;
}

async function authFetch<T>(url: string, init: RequestInit = {}): Promise<AuthResponse<T>> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { data: body as T, error: { message: body?.error || "Requete refusee." } };
  }
  return { data: body as T, error: null };
}

class BrowserProfileQuery {
  private filters: Record<string, unknown> = {};

  constructor(private table: string) {}

  eq(column: string, value: unknown) {
    this.filters[column] = value;
    return this;
  }

  select() {
    return this;
  }

  async maybeSingle() {
    if (this.table !== "profiles") {
      return { data: null, error: { message: "Client browser local limite aux profils." } };
    }
    const session = readStoredSession();
    if (!session?.access_token) return { data: null, error: { message: "Session absente." } };
    const response = await fetch("/api/auth/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: { message: body?.error || "Profil indisponible." } };
    if (this.filters.id && body.profile?.id !== this.filters.id) {
      return { data: null, error: { message: "Acces refuse." } };
    }
    return { data: body.profile || null, error: null };
  }
}

export function hasSupabaseEnv() {
  return Boolean(process.env.DATABASE_URL);
}

export function createBrowserClient(): any {
  if (!isBrowser()) return null;

  return {
    auth: {
      async exchangeCodeForSession(_code?: string) {
        const session = readStoredSession();
        if (session) await syncSessionCookie(session);
        return { data: { session: readStoredSession() }, error: null };
      },
      async getSession() {
        const session = readStoredSession();
        if (session) await syncSessionCookie(session);
        return { data: { session: readStoredSession() }, error: null };
      },
      async getUser() {
        const session = readStoredSession();
        if (!session?.access_token) return { data: { user: null }, error: { message: "Session absente." } };
        if (!await syncSessionCookie(session)) {
          return { data: { user: null }, error: { message: "Session invalide." } };
        }
        const response = await fetch("/api/auth/user", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) return { data: { user: null }, error: { message: body?.error || "Session invalide." } };
        return { data: { user: body.user }, error: null };
      },
      onAuthStateChange(callback: (_event: string, session: BrowserSession | null) => void) {
        const handler = (event: Event) => callback("TOKEN_REFRESHED", (event as CustomEvent).detail || readStoredSession());
        window.addEventListener("irenee-auth-change", handler);
        return {
          data: {
            subscription: {
              unsubscribe: () => window.removeEventListener("irenee-auth-change", handler)
            }
          }
        };
      },
      async signInWithPassword(credentials: { email: string; password: string }) {
        const { data, error } = await authFetch<{ session: BrowserSession; user: BrowserSession["user"] }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(credentials)
        });
        if (!error && data.session) {
          syncedAccessToken = data.session.access_token;
          writeStoredSession(data.session);
        }
        return { data, error };
      },
      async signOut(_options?: unknown) {
        writeStoredSession(null);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        return { error: null };
      },
      async signUp(input: { email: string; password: string; options?: { data?: Record<string, unknown>; emailRedirectTo?: string } }) {
        const { data, error } = await authFetch<{ session: BrowserSession; user: BrowserSession["user"] }>("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            email: input.email,
            metadata: input.options?.data || {},
            password: input.password
          })
        });
        if (!error && data.session) {
          syncedAccessToken = data.session.access_token;
          writeStoredSession(data.session);
        }
        return { data, error };
      }
    },
    from(table: string) {
      return new BrowserProfileQuery(table);
    }
  };
}

export function createServerClient(): LocalServerClient | null {
  if (isBrowser()) return null;
  // Keep this module browser-safe: the PostgreSQL implementation is loaded only
  // in the Node.js runtime.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createLocalServerClient } = require("./local-server-client") as typeof import("./local-server-client");
  return createLocalServerClient();
}
