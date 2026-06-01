import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl && publishableKey);
}

export function createBrowserClient() {
  if (!hasSupabaseEnv()) return null;
  return createSupabaseBrowserClient(supabaseUrl, publishableKey);
}

export function createServerClient() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || publishableKey;
  if (!supabaseUrl || !secret) return null;
  return createSupabaseClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
