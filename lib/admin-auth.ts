import { createServerClient as createSupabaseAuthClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient, hasSupabaseEnv } from "@/lib/supabase";

export async function requireDirectorPage() {
  if (!hasSupabaseEnv()) redirect("/auth/login?next=/admin");

  const cookieStore = await cookies();
  const authClient = createSupabaseAuthClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: cookiesToSet => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot always write refreshed cookies.
          }
        }
      }
    }
  );

  const { data } = await authClient.auth.getUser();
  if (!data.user) redirect("/auth/login?next=/admin");

  const supabase = createServerClient();
  if (!supabase) redirect("/auth/login?next=/admin");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "directeur") redirect("/");
}
