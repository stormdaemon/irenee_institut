import { hasDatabaseEnv } from "@/lib/db";
import { pgRead } from "@/lib/postgres";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SECURE_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, verifyAccessToken } from "@/lib/local-auth";
import { createServerContext } from "@/lib/postgres";
import type { Profile, Role } from "@/lib/types";

function loginRedirect(nextPath: string): never {
  redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
}

export async function requireAdminPage(allowedRoles: Role[] = ["directeur", "formateur"], nextPath = "/admin") {
  if (!hasDatabaseEnv()) loginRedirect(nextPath);

  const cookieStore = await cookies();
  const token = cookieStore.get(SECURE_SESSION_COOKIE_NAME)?.value || cookieStore.get(SESSION_COOKIE_NAME)?.value || "";
  if (!token) loginRedirect(nextPath);

  const { user } = await verifyAccessToken(token);
  if (!user) loginRedirect(nextPath);

  const context = createServerContext();
  if (!context) loginRedirect(nextPath);

  const { data: profile } = await pgRead("select t.* from public.\"profiles\" t where t.\"id\" = $1", [user.id], "optional");
  const typedProfile = profile as Profile | null;
  if (!typedProfile || !allowedRoles.includes(typedProfile.role)) {
    redirect(typedProfile?.role === "formateur" ? "/admin" : "/");
  }

  return typedProfile;
}

export async function requireDirectorPage(nextPath = "/admin") {
  return requireAdminPage(["directeur"], nextPath);
}
