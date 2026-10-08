import { pgRead } from "@/lib/postgres";
import { NextResponse } from "next/server";
import { createServerContext } from "@/lib/postgres";
import { getRequestSessionToken } from "@/lib/local-auth";
import { assertSameOrigin, RequestSecurityError } from "@/lib/request-security";
import type { LocalUser } from "@/lib/local-auth";
import type { Profile, Role } from "@/lib/types";

type ServerClient = NonNullable<ReturnType<typeof createServerContext>>;

type AuthenticatedUser = {
  ok: true;
  authMethod: "bearer" | "cookie";
  context: ServerClient;
  user: LocalUser;
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
  const context = createServerContext();
  if (!context) {
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

  const { data, error } = await context.sessions.getUser(token);
  if (error || !data.user) {
    return { ok: false, response: errorResponse("Session invalide ou expirée.", 401) };
  }

  return { authMethod: viaCookie ? "cookie" : "bearer", ok: true, context, user: data.user };
}

export async function authorizeRequest(request: Request, allowedRoles: Role[]): Promise<AuthenticatedProfile | AuthFailure> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated.ok) return authenticated;

  const { data, error } = await pgRead("select t.* from public.\"profiles\" t where t.\"id\" = $1", [authenticated.user.id], "optional");

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
