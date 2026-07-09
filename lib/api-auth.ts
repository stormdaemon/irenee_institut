import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getRequestSessionToken } from "@/lib/local-auth";
import { assertSameOrigin, RequestSecurityError } from "@/lib/request-security";
import type { LocalServerUser } from "@/lib/local-server-client";
import type { Profile, Role } from "@/lib/types";

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>;

type AuthenticatedUser = {
  ok: true;
  authMethod: "bearer" | "cookie";
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
  return NextResponse.json({ ok: false, error }, {
    headers: { "Cache-Control": "no-store" },
    status
  });
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedUser | AuthFailure> {
  const supabase = createServerClient();
  if (!supabase) {
    return { ok: false, response: errorResponse("Le service est momentanement indisponible.", 501) };
  }

  const { token, viaCookie } = getRequestSessionToken(request);
  if (!token) {
    return { ok: false, response: errorResponse("Connexion requise.", 401) };
  }

  if (viaCookie) {
    try {
      assertSameOrigin(request);
    } catch (error) {
      if (error instanceof RequestSecurityError) {
        return { ok: false, response: errorResponse("Requête refusée.", error.status) };
      }
      return { ok: false, response: errorResponse("Requête refusée.", 403) };
    }
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, response: errorResponse("Session invalide ou expirée.", 401) };
  }

  return { authMethod: viaCookie ? "cookie" : "bearer", ok: true, supabase, user: data.user };
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
    console.error("authorization_profile_lookup_failed", { userId: authenticated.user.id });
    return { ok: false, response: errorResponse("L'autorisation n'a pas pu être vérifiée.", 500) };
  }

  const profile = data as Profile | null;
  if (!profile || !allowedRoles.includes(profile.role)) {
    return { ok: false, response: errorResponse("Acces refuse.", 403) };
  }

  return { ...authenticated, profile };
}
