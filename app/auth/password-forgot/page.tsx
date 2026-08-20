"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { FormEvent, useRef, useState } from "react";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PasswordForgotPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [emailError, setEmailError] = useState("");
  const [serverError, setServerError] = useState("");
  const emailRef = useRef<HTMLInputElement | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    const email = String(new FormData(event.currentTarget).get("email") || "").trim().toLowerCase();
    if (!emailPattern.test(email) || email.length > 254) {
      setEmailError("Indiquez une adresse email valide.");
      setServerError("");
      setStatus("error");
      emailRef.current?.focus();
      return;
    }

    setEmailError("");
    setServerError("");
    setStatus("submitting");
    const response = await fetch("/api/auth/password/reset/request", {
      body: JSON.stringify({ email }),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }).catch(() => null);

    if (!response?.ok) {
      const body = await response?.json().catch(() => ({}));
      setServerError(
        response?.status === 429
          ? body?.error || "Trop de demandes. Réessayez plus tard."
          : "La demande n'a pas pu être transmise. Réessayez dans quelques instants."
      );
      setStatus("error");
      return;
    }
    setStatus("success");
    event.currentTarget.reset();
  }

  const isSubmitting = status === "submitting";
  return (
    <section className="auth-shell">
      <div className="auth-intro center">
        <span className="auth-icon"><KeyRound size={34} aria-hidden="true" /></span>
        <h1 className="title">Mot de passe oublié</h1>
        <p className="subtitle">Recevez un lien à usage unique pour choisir un nouveau mot de passe.</p>
      </div>

      <form method="post" onSubmit={submit} className="card auth-card" noValidate>
        {status === "success" && (
          <div className="auth-notice auth-notice-success" role="status" aria-live="polite">
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <strong>Demande prise en compte</strong>
              <p>Si un compte actif correspond à cette adresse, un lien vient d'être envoyé. Il reste valable 30 minutes.</p>
            </div>
          </div>
        )}
        {serverError && (
          <div className="auth-notice auth-notice-error" role="alert" aria-live="assertive">
            <AlertTriangle size={20} aria-hidden="true" />
            <div><strong>Demande indisponible</strong><p>{serverError}</p></div>
          </div>
        )}

        <label className="auth-field" htmlFor="password-reset-email">
          <span>Adresse email du compte</span>
          <span className="auth-input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input
              ref={emailRef}
              className="input"
              id="password-reset-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              disabled={isSubmitting}
              aria-describedby={emailError ? "password-reset-email-error" : undefined}
              aria-invalid={Boolean(emailError)}
              required
            />
          </span>
          {emailError && <small id="password-reset-email-error" className="field-error">{emailError}</small>}
        </label>

        <button className="btn btn-primary auth-submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="action-spin" size={18} aria-hidden="true" />}
          {isSubmitting ? "Envoi…" : status === "success" ? "Renvoyer un lien" : "Recevoir le lien"}
        </button>
        <p className="auth-switch"><Link href="/auth/login"><strong>Retour à la connexion</strong></Link></p>
      </form>

      <Link className="auth-back" href="/">← Retour à l'accueil</Link>
    </section>
  );
}
