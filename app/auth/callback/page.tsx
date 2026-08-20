"use client";

import Link from "next/link";
import { AlertTriangle, Loader2, Lock, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { translateAuthError, type AuthErrorCopy } from "@/lib/auth-errors";
import { safeInternalPath } from "@/lib/request-security";
import { createBrowserClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [notice, setNotice] = useState<AuthErrorCopy | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [passwordError, setPasswordError] = useState("");
  const codeRef = useRef("");
  const nextRef = useRef("/espace-etudiant");

  useEffect(() => {
    const url = new URL(window.location.href);
    codeRef.current = new URLSearchParams(url.hash.slice(1)).get("code") || "";
    nextRef.current = safeInternalPath(url.searchParams.get("next"), "/espace-etudiant");

    // The one-time credential is kept only in memory and removed from browser
    // history before the user enters a password.
    url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);

    if (!codeRef.current) {
      setNotice({
        title: "Lien de confirmation invalide",
        description: "Ce lien est incomplet. Demandez un nouveau lien depuis la page de connexion.",
        field: "form"
      });
      setStatus("error");
      return;
    }
    setStatus("ready");
  }, []);

  async function completeRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const passwordConfirmation = String(form.get("passwordConfirmation") || "");
    if (password.length < 12) {
      setPasswordError("Le mot de passe doit contenir au moins 12 caractères.");
      return;
    }
    if (password !== passwordConfirmation) {
      setPasswordError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    const supabase = createBrowserClient();
    if (!supabase) {
      setNotice({
        title: "Activation indisponible",
        description: "Le service est momentanément indisponible. Demandez un nouveau lien avant de réessayer.",
        field: "form"
      });
      setStatus("error");
      return;
    }

    setPasswordError("");
    setNotice(null);
    setStatus("submitting");
    const { error } = await supabase.auth.exchangeCodeForSession(
      codeRef.current,
      password,
      passwordConfirmation
    );
    if (error) {
      if (/mot de passe|caractères|octets|courant/i.test(error.message || "")) {
        setPasswordError(error.message);
        setStatus("ready");
      } else {
        setNotice(translateAuthError(error.message, "Le lien n'a pas pu activer votre compte."));
        setStatus("error");
        codeRef.current = "";
      }
      return;
    }

    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session) {
      setNotice(translateAuthError(sessionError?.message, "Le compte est activé, mais la connexion n'a pas pu être finalisée."));
      setStatus("error");
      return;
    }

    const meResponse = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
    if (!meResponse.ok) {
      const meResult = await meResponse.json().catch(() => null);
      await supabase.auth.signOut();
      setNotice({
        title: "Compte activé, espace indisponible",
        description: meResult?.error || "Votre espace n'a pas pu être chargé.",
        field: "form"
      });
      setStatus("error");
      return;
    }

    window.location.replace(nextRef.current);
  }

  return (
    <section className="auth-shell">
      <div className="card auth-card">
        {status === "loading" ? (
          <div className="center">
            <Loader2 className="action-spin" size={34} aria-hidden="true" />
            <h1 className="title">Vérification du lien</h1>
          </div>
        ) : status === "ready" || status === "submitting" ? (
          <form method="post" onSubmit={completeRegistration} noValidate>
            <div className="center">
              <ShieldCheck size={36} aria-hidden="true" />
              <h1 className="title">Sécuriser mon compte</h1>
              <p className="subtitle">Votre adresse est vérifiée. Choisissez maintenant une phrase de passe unique.</p>
            </div>

            <label className="auth-field">
              <span>Mot de passe</span>
              <span className="auth-input-wrap">
                <Lock size={18} aria-hidden="true" />
                <input className="input" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={status === "submitting"} aria-invalid={Boolean(passwordError)} />
              </span>
              <small className={passwordError ? "field-error" : "auth-help"}>{passwordError || "12 caractères minimum ; une phrase longue et unique est recommandée."}</small>
            </label>

            <label className="auth-field">
              <span>Confirmer le mot de passe</span>
              <span className="auth-input-wrap">
                <Lock size={18} aria-hidden="true" />
                <input className="input" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={status === "submitting"} aria-invalid={Boolean(passwordError)} />
              </span>
            </label>

            <button className="btn btn-primary auth-submit" disabled={status === "submitting"}>
              {status === "submitting" && <Loader2 className="action-spin" size={18} aria-hidden="true" />}
              {status === "submitting" ? "Activation…" : "Activer et me connecter"}
            </button>
          </form>
        ) : (
          <div className="center">
            <div className="auth-notice auth-notice-error" role="alert" aria-live="polite">
              <AlertTriangle size={20} aria-hidden="true" />
              <div>
                <strong>{notice?.title || "Activation impossible"}</strong>
                <p>{notice?.description || "Demandez un nouveau lien puis réessayez."}</p>
              </div>
            </div>
            <Link className="btn btn-primary" href="/auth/login">Retour à la connexion</Link>
          </div>
        )}
      </div>
    </section>
  );
}
