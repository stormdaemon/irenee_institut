import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { LocalServerUser } from "@/lib/local-server-client";
import type { Profile, Role } from "@/lib/types";

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>;

type AuthenticatedUser = {
  ok: true;
  supabase: ServerClient;
  user: LocalServerUser;
};

type AuthenticatedProfile = AuthenticatedUser & {
  profile: Profile;
};

type AuthFailure = {
  ok: false;
  response: NextResponse;
};

function errorResponse(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedUser | AuthFailure> {
  const supabase = createServerClient();
  if (!supabase) {
    return { ok: false, response: errorResponse("Le service est momentanement indisponible.", 501) };
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { ok: false, response: errorResponse("Connexion requise.", 401) };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, response: errorResponse(error?.message || "Session invalide ou expiree.", 401) };
  }

  return { ok: true, supabase, user: data.user };
}

export async function authorizeRequest(request: Request, allowedRoles: Role[]): Promise<AuthenticatedProfile | AuthFailure> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated.ok) return authenticated;

  const { data, error } = await authenticated.supabase
    .from("profiles")
    .select("*")
    .eq("id", authenticated.user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, response: errorResponse(error.message, 400) };
  }

  const profile = data as Profile | null;
  if (!profile || !allowedRoles.includes(profile.role)) {
    return { ok: false, response: errorResponse("Acces refuse.", 403) };
  }

  return { ...authenticated, profile };
}
