"use client";

import { createBrowserClient } from "@/lib/supabase";

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = createBrowserClient();
  if (!supabase) throw new Error("Le service est momentanement indisponible.");

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error(error?.message || "Connexion requise.");
  return fetch(input, { ...init, credentials: "same-origin" });
}
