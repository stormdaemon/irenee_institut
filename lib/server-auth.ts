import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "./supabase";
import type { Profile } from "./types";

export const ADMIN_SESSION_COOKIE = "irenee-admin-session";

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>;
type AuthContext = {
  supabase: ServerClient;
  user: { id: string; email?: string | null };
  profile: Profile;
};

type Authorized = AuthContext & { ok: true };
type Rejected = { ok: false; response: NextResponse };

function isStaff(profile: Profile) {
  return profile.role === "directeur" || profile.role === "formateur";
}

function unauthorized(message = "Vous devez etre connecte pour acceder a cet espace.") {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

function forbidden(message = "Vous n'avez pas les droits necessaires pour effectuer cette action.") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function bearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
}

function cookieToken(request: Request) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === ADMIN_SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return "";
}

async function authenticate(token: string): Promise<AuthContext | null> {
  const supabase = createServerClient();
  if (!supabase || !token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile) return null;
  return { supabase, user: data.user, profile: profile as Profile };
}

export async function authorizeBearerUser(request: Request): Promise<Authorized | Rejected> {
  const context = await authenticate(bearerToken(request));
  return context ? { ok: true, ...context } : { ok: false, response: unauthorized() };
}

export async function authorizeUser(request: Request): Promise<Authorized | Rejected> {
  const context = await authenticate(bearerToken(request) || cookieToken(request));
  return context ? { ok: true, ...context } : { ok: false, response: unauthorized() };
}

export async function authorizeDirector(request: Request): Promise<Authorized | Rejected> {
  const auth = await authorizeUser(request);
  if (!auth.ok) return auth;
  return auth.profile.role === "directeur"
    ? auth
    : { ok: false, response: forbidden() };
}

export async function authorizeStaff(request: Request): Promise<Authorized | Rejected> {
  const auth = await authorizeUser(request);
  if (!auth.ok) return auth;
  return isStaff(auth.profile)
    ? auth
    : { ok: false, response: forbidden() };
}

export async function requireDirectorSession() {
  const store = await cookies();
  const context = await authenticate(store.get(ADMIN_SESSION_COOKIE)?.value || "");
  return context?.profile.role === "directeur" ? context : null;
}

export async function requireStaffSession() {
  const store = await cookies();
  const context = await authenticate(store.get(ADMIN_SESSION_COOKIE)?.value || "");
  return context && isStaff(context.profile) ? context : null;
}
