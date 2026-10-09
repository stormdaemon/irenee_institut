import { hasDatabaseEnv } from "@/lib/db";
import { pgRead } from "@/lib/postgres";
import { cookies } from "next/headers";
import { SECURE_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, verifyAccessToken } from "@/lib/local-auth";
import { createServerContext } from "@/lib/postgres";
import type { Profile } from "@/lib/types";

/**
 * Reads the current profile for public server-rendered pages without turning
 * those pages into authentication gates. Invalid or expired sessions are
 * treated like anonymous visits.
 */
export async function getOptionalPageProfile(): Promise<Profile | null> {
  if (!hasDatabaseEnv()) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SECURE_SESSION_COOKIE_NAME)?.value
    || cookieStore.get(SESSION_COOKIE_NAME)?.value
    || "";
  if (!token) return null;

  const { user } = await verifyAccessToken(token);
  if (!user) return null;

  const context = createServerContext();
  if (!context) return null;
  const { data, error } = await pgRead("select t.* from public.\"profiles\" t where t.\"id\" = $1", [user.id], "optional");

  return error ? null : data as Profile | null;
}
