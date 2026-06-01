"use client";

import { createBrowserClient } from "@/lib/supabase";

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = createBrowserClient();
  if (!supabase) throw new Error("Le service est momentanement indisponible.");

  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error(error?.message || "Connexion requise.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
