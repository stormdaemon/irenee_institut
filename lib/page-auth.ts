import { cookies } from "next/headers";
import { SECURE_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, verifyAccessToken } from "@/lib/local-auth";
import { createServerClient, hasSupabaseEnv } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

/**
 * Reads the current profile for public server-rendered pages without turning
 * those pages into authentication gates. Invalid or expired sessions are
 * treated like anonymous visits.
 */
export async function getOptionalPageProfile(): Promise<Profile | null> {
  if (!hasSupabaseEnv()) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SECURE_SESSION_COOKIE_NAME)?.value
    || cookieStore.get(SESSION_COOKIE_NAME)?.value
    || "";
  if (!token) return null;

  const { user } = await verifyAccessToken(token);
  if (!user) return null;

  const supabase = createServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return error ? null : data as Profile | null;
}
