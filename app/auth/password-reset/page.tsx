"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Lock } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { safeInternalPath } from "@/lib/request-security";
import { createBrowserClient } from "@/lib/supabase";

type ResetStatus = "loading" | "ready" | "submitting" | "success" | "error";

export default function PasswordResetPage() {
  const [status, setStatus] = useState<ResetStatus>("loading");
  const [passwordError, setPasswordError] = useState("");
  const [notice, setNotice] = useState("");
  const [automaticLoginFailed, setAutomaticLoginFailed] = useState(false);
  const codeRef = useRef("");
  const nextRef = useRef("/espace-etudiant");

  useEffect(() => {
    const url = new URL(window.location.href);
    codeRef.current = new URLSearchParams(url.hash.slice(1)).get("code") || "";
    nextRef.current = safeInternalPath(url.searchParams.get("next"), "/espace-etudiant");
    // Erase the one-time credential before the user interacts with the page.
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    if (!codeRef.current || codeRef.current.length > 256) {
      codeRef.current = "";
      setNotice("Ce lien est incomplet, invalide ou expiré. Demandez-en un nouveau.");
      setStatus("error");
      return;
    }
    setStatus("ready");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || !codeRef.current) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const passwordConfirmation = String(form.get("passwordConfirmation") || "");
    if (password.length < 12) {
      setPasswordError("Le mot de passe doit contenir au moins 12 caractères.");
      return;
    }
    if (password.length > 128) {
      setPasswordError("Le mot de passe ne peut pas dépasser 128 caractères.");
      return;
    }
    if (password !== passwordConfirmation) {
      setPasswordError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPasswordError("");
    setNotice("");
    setStatus("submitting");
    const response = await fetch("/api/auth/password/reset/complete", {
      body: JSON.stringify({ code: codeRef.current, password, passwordConfirmation }),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));

    if (!response?.ok) {
      const message = String(body?.error || "La réinitialisation n'a pas pu être effectuée.");
      if (/mot de passe|caractères|octets|courant|correspondent/i.test(message)) {
        setPasswordError(message);
        setStatus("ready");
        return;
      }
      setNotice(message);
      codeRef.current = "";
      setStatus("error");
      return;
    }

    const loginEmail = typeof body?.loginEmail === "string" ? body.loginEmail : "";
    if (loginEmail) {
      const supabase = createBrowserClient();
      const login = supabase
        ? await supabase.auth.signInWithPassword({ email: loginEmail, password })
        : { data: null, error: { message: "Service de connexion indisponible." } };
      if (!login.error && login.data?.session) {
        codeRef.current = "";
        window.location.replace(nextRef.current);
        return;
      }
      setAutomaticLoginFailed(true);
    }

    codeRef.current = "";
    event.currentTarget.reset();
    setStatus("success");
  }

  if (status === "loading") {
    return (
      <section className="auth-shell">
        <div className="card auth-card center" role="status" aria-live="polite">
          <Loader2 className="action-spin" size={34} aria-hidden="true" />
          <h1 className="title">Vérification du lien</h1>
        </div>
      </section>
    );
  }

  if (status === "success") {
    const loginHref = nextRef.current === "/espace-etudiant"
      ? "/auth/login"
      : `/auth/login?next=${encodeURIComponent(nextRef.current)}`;
    return (
      <section className="auth-shell">
        <div className="card auth-card center">
          <CheckCircle2 size={42} aria-hidden="true" />
          <h1 className="title">Mot de passe modifié</h1>
          <div className="auth-notice auth-notice-success" role="status" aria-live="polite">
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <strong>Compte sécurisé</strong>
              <p>{automaticLoginFailed
                ? "Le mot de passe a bien été modifié. Connectez-vous en saisissant ce nouveau mot de passe, sans utiliser une ancienne valeur enregistrée."
                : "Le mot de passe a bien été modifié. Connectez-vous avec ce nouveau mot de passe."}</p>
            </div>
          </div>
          <Link className="btn btn-primary auth-submit" href={loginHref}>Se connecter</Link>
        </div>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="auth-shell">
        <div className="card auth-card center">
          <AlertTriangle size={42} aria-hidden="true" />
          <h1 className="title">Réinitialisation impossible</h1>
          <div className="auth-notice auth-notice-error" role="alert" aria-live="assertive">
            <AlertTriangle size={20} aria-hidden="true" />
            <div><strong>Lien inutilisable</strong><p>{notice}</p></div>
          </div>
          <Link className="btn btn-primary auth-submit" href="/auth/password-forgot">Demander un nouveau lien</Link>
          <p className="auth-switch"><Link href="/auth/login"><strong>Retour à la connexion</strong></Link></p>
        </div>
      </section>
    );
  }

  const isSubmitting = status === "submitting";
  return (
    <section className="auth-shell">
      <div className="auth-intro center">
        <span className="auth-icon"><KeyRound size={34} aria-hidden="true" /></span>
        <h1 className="title">Choisir un nouveau mot de passe</h1>
        <p className="subtitle">Une phrase longue, unique et mémorisable protège mieux votre compte.</p>
      </div>

      <form method="post" onSubmit={submit} className="card auth-card" noValidate>
        <label className="auth-field" htmlFor="new-password">
          <span>Nouveau mot de passe</span>
          <span className="auth-input-wrap">
            <Lock size={18} aria-hidden="true" />
            <input
              className="input"
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              disabled={isSubmitting}
              aria-describedby="new-password-help"
              aria-invalid={Boolean(passwordError)}
            />
          </span>
          <small id="new-password-help" className={passwordError ? "field-error" : "auth-help"}>
            {passwordError || "12 caractères minimum ; évitez tout mot de passe réutilisé ailleurs."}
          </small>
        </label>

        <label className="auth-field" htmlFor="new-password-confirmation">
          <span>Confirmer le nouveau mot de passe</span>
          <span className="auth-input-wrap">
            <Lock size={18} aria-hidden="true" />
            <input
              className="input"
              id="new-password-confirmation"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              disabled={isSubmitting}
              aria-describedby={passwordError ? "new-password-help" : undefined}
              aria-invalid={Boolean(passwordError)}
            />
          </span>
        </label>

        <button className="btn btn-primary auth-submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="action-spin" size={18} aria-hidden="true" />}
          {isSubmitting ? "Sécurisation…" : "Modifier mon mot de passe"}
        </button>
      </form>
    </section>
  );
}
