"use client";

import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { translateAuthError, type AuthErrorCopy } from "@/lib/auth-errors";
import { createBrowserClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [notice, setNotice] = useState<AuthErrorCopy | null>(null);
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    let mounted = true;

    async function completeSession() {
      const supabase = createBrowserClient();
      if (!supabase) {
        if (!mounted) return;
        setNotice({
          title: "Connexion indisponible",
          description: "La connexion est momentanément indisponible. Réessayez dans quelques instants.",
          field: "form"
        });
        setStatus("error");
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const next = url.searchParams.get("next") || "/espace-etudiant";

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!mounted) return;
          setNotice(translateAuthError(error.message, "Le lien de confirmation n'a pas pu ouvrir votre compte."));
          setStatus("error");
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) {
        if (!mounted) return;
        setNotice(translateAuthError(error?.message, "Le lien a été ouvert, mais la connexion n'a pas pu être finalisée."));
        setStatus("error");
        return;
      }

      const meResponse = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });

      if (!meResponse.ok) {
        const meResult = await meResponse.json().catch(() => null);
        await supabase.auth.signOut();
        if (!mounted) return;
        setNotice({
          title: "Compte confirmé, espace indisponible",
          description: meResult?.error || "Votre espace n'a pas pu être chargé.",
          field: "form"
        });
        setStatus("error");
        return;
      }

      window.location.replace(next);
    }

    completeSession();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="auth-shell">
      <div className="card auth-card center">
        {status === "loading" ? (
          <>
            <Loader2 className="action-spin" size={34} aria-hidden="true" />
            <h1 className="title">Confirmation du compte</h1>
            <p className="subtitle">Finalisation de votre connexion...</p>
          </>
        ) : (
          <>
            <div className="auth-notice auth-notice-error" role="alert" aria-live="polite">
              <AlertTriangle size={20} aria-hidden="true" />
              <div>
                <strong>{notice?.title || "Connexion impossible"}</strong>
                <p>{notice?.description || "La connexion n'a pas pu être finalisée."}</p>
              </div>
            </div>
            <Link className="btn btn-primary" href="/auth/login">Retour à la connexion</Link>
          </>
        )}
      </div>
    </section>
  );
}
