type AuthResponse<T> = {
  data: T;
  error: { message: string } | null;
};

type BrowserUser = {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
  identities?: unknown[];
};

type BrowserSession = {
  expires_at: number;
  expires_in?: number;
  token_type: "cookie" | "bearer";
  user: BrowserUser;
};

import type { LocalServerClient } from "./local-server-client";

let cachedSession: BrowserSession | null | undefined;
let pendingSession: Promise<BrowserSession | null> | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function announceSession(session: BrowserSession | null) {
  cachedSession = session;
  if (isBrowser()) window.dispatchEvent(new CustomEvent("irenee-auth-change", { detail: session }));
}

async function authFetch<T>(url: string, init: RequestInit = {}): Promise<AuthResponse<T>> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { data: body as T, error: { message: body?.error || "Requête refusée." } };
  }
  return { data: body as T, error: null };
}

async function loadSession(force = false) {
  if (!isBrowser()) return null;
  if (!force && cachedSession !== undefined) return cachedSession;
  if (pendingSession) return pendingSession;

  pendingSession = fetch("/api/auth/user", { cache: "no-store", credentials: "same-origin" })
    .then(async response => {
      if (!response.ok) return null;
      const body = await response.json().catch(() => ({}));
      return body.session?.user ? body.session as BrowserSession : null;
    })
    .catch(() => null)
    .then(session => {
      cachedSession = session;
      return session;
    })
    .finally(() => {
      pendingSession = null;
    });
  return pendingSession;
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
      return { data: null, error: { message: "Client navigateur limité aux profils." } };
    }
    const session = await loadSession();
    if (!session) return { data: null, error: { message: "Session absente." } };
    const response = await fetch("/api/auth/profile", { cache: "no-store", credentials: "same-origin" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: { message: body?.error || "Profil indisponible." } };
    if (this.filters.id && body.profile?.id !== this.filters.id) {
      return { data: null, error: { message: "Accès refusé." } };
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
      async exchangeCodeForSession(code?: string, password?: string, passwordConfirmation?: string) {
        const next = new URLSearchParams(window.location.search).get("next") || "/espace-etudiant";
        const { data, error } = await authFetch<{ session: BrowserSession; user: BrowserUser }>("/api/auth/verify", {
          body: JSON.stringify({ code, next, password, passwordConfirmation }),
          method: "POST"
        });
        if (!error && data.session) announceSession(data.session);
        return { data, error };
      },
      async getSession() {
        const session = await loadSession();
        return { data: { session }, error: null };
      },
      async getUser() {
        const session = await loadSession(true);
        return session
          ? { data: { user: session.user }, error: null }
          : { data: { user: null }, error: { message: "Session absente." } };
      },
      onAuthStateChange(callback: (_event: string, session: BrowserSession | null) => void) {
        const handler = (event: Event) => callback("SIGNED_IN", (event as CustomEvent).detail || null);
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
        const { data, error } = await authFetch<{ session: BrowserSession; user: BrowserUser }>("/api/auth/login", {
          body: JSON.stringify(credentials),
          method: "POST"
        });
        if (!error && data.session) announceSession(data.session);
        return { data, error };
      },
      async signOut(_options?: unknown) {
        await fetch("/api/auth/logout", { credentials: "same-origin", method: "POST" }).catch(() => undefined);
        announceSession(null);
        return { error: null };
      },
      async signUp(input: { email: string; password?: string; options?: { data?: Record<string, unknown>; emailRedirectTo?: string } }) {
        let next = "/espace-etudiant";
        try {
          if (input.options?.emailRedirectTo) {
            const redirect = new URL(input.options.emailRedirectTo, window.location.origin);
            next = redirect.searchParams.get("next") || next;
          }
        } catch {
          // The server also validates the target and will use the safe default.
        }
        const { data, error } = await authFetch<{ confirmationRequired: boolean; session: null; user: { email: string } }>("/api/auth/signup", {
          body: JSON.stringify({
            email: input.email,
            metadata: input.options?.data || {},
            next
          }),
          method: "POST"
        });
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
