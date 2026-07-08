import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifyAccessToken } from "@/lib/local-auth";
import { createServerClient, hasSupabaseEnv } from "@/lib/supabase";
import type { Profile, Role } from "@/lib/types";

function loginRedirect(nextPath: string): never {
  redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
}

export async function requireAdminPage(allowedRoles: Role[] = ["directeur", "formateur"], nextPath = "/admin") {
  if (!hasSupabaseEnv()) loginRedirect(nextPath);

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value || "";
  if (!token) loginRedirect(nextPath);

  const { user } = await verifyAccessToken(token);
  if (!user) loginRedirect(nextPath);

  const supabase = createServerClient();
  if (!supabase) loginRedirect(nextPath);

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const typedProfile = profile as Profile | null;
  if (!typedProfile || !allowedRoles.includes(typedProfile.role)) {
    redirect(typedProfile?.role === "formateur" ? "/admin" : "/");
  }

  return typedProfile;
}

export async function requireDirectorPage(nextPath = "/admin") {
  return requireAdminPage(["directeur"], nextPath);
}
