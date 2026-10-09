"use client";

import { createBrowserClient } from "@/lib/browser-auth";

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const context = createBrowserClient();
  if (!context) throw new Error("Le service est momentanement indisponible.");

  const { data, error } = await context.auth.getSession();
  if (error || !data.session) throw new Error(error?.message || "Connexion requise.");
  return fetch(input, { ...init, credentials: "same-origin" });
}
