"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Lock, LogIn, Mail } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { translateAuthError, type AuthErrorCopy } from "@/lib/auth-errors";
import { safeInternalPath } from "@/lib/request-security";
import { annualPassCheckoutPath, cleanAnnualPassSignupPath } from "@/lib/routes";
import { createBrowserClient } from "@/lib/supabase";

type FieldErrors = Partial<Record<"email" | "password", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSafeNextPath() {
  if (typeof window === "undefined") return "/espace-etudiant";
  return safeInternalPath(new URLSearchParams(window.location.search).get("next"), "/espace-etudiant");
}

export default function LoginPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [notice, setNotice] = useState<AuthErrorCopy | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [signupHref, setSignupHref] = useState("/auth/signup");
  const [resendStatus, setResendStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const noticeRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const next = getSafeNextPath();
    setSignupHref(
      next === annualPassCheckoutPath
        ? cleanAnnualPassSignupPath
        : next === "/espace-etudiant"
          ? "/auth/signup"
          : `/auth/signup?next=${encodeURIComponent(next)}`
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function continueExistingSession() {
      const supabase = createBrowserClient();
      if (!supabase) return;

      const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      if (!data.session) return;

      const meResponse = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" }).catch(() => null);
      if (!meResponse?.ok || cancelled) return;

      window.location.replace(getSafeNextPath());
    }

    continueExistingSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice || status === "submitting") return;
    noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [notice, status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setStatus("submitting");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const nextFieldErrors: FieldErrors = {};

    if (!email) nextFieldErrors.email = "Renseignez votre adresse email.";
    else if (!emailPattern.test(email)) nextFieldErrors.email = "Indiquez une adresse email valide.";
    if (!password) nextFieldErrors.password = "Renseignez votre mot de passe.";

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setNotice({
        title: "Informations à corriger",
        description: "Les champs marqués doivent être corrigés avant de vous connecter.",
        field: "form"
      });
      setStatus("error");
      return;
    }

    setFieldErrors({});
    const supabase = createBrowserClient();
    if (!supabase) {
      setNotice({
        title: "Connexion indisponible",
        description: "La connexion est momentanément indisponible. Réessayez dans quelques instants.",
        field: "form"
      });
      setStatus("error");
      return;
    }

    await supabase.auth.signOut();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      const translated = translateAuthError(error.message, "La connexion a échoué.");
      setNotice(translated);
      setStatus("error");
      if (translated.field === "email") setFieldErrors({ email: translated.description });
      if (translated.field === "password") setFieldErrors({ password: translated.description });
      return;
    }

    if (!data.session || !data.user) {
      setNotice({
        title: "Connexion non confirmée",
        description: "Vérifiez que votre email est confirmé et que le mot de passe est correct.",
        field: "form"
      });
      setStatus("error");
      return;
    }

    const meResponse = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });

    if (!meResponse.ok) {
      const meResult = await meResponse.json().catch(() => null);
      await supabase.auth.signOut();
      setNotice({
        title: "Compte incomplet",
        description: meResult?.error || "Votre espace n'a pas pu être chargé.",
        field: "form"
      });
      setStatus("error");
      return;
    }

    window.location.href = getSafeNextPath();
  }

  async function resendVerification() {
    const form = formRef.current;
    const email = String(form ? new FormData(form).get("email") || "" : "").trim().toLowerCase();
    if (!emailPattern.test(email)) {
      setFieldErrors(current => ({ ...current, email: "Indiquez l'adresse email à confirmer." }));
      setResendStatus("error");
      return;
    }

    setResendStatus("submitting");
    const response = await fetch("/api/auth/verification/resend", {
      body: JSON.stringify({ email, next: getSafeNextPath() }),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }).catch(() => null);
    setResendStatus(response?.ok ? "success" : "error");
  }

  const isSubmitting = status === "submitting";

  return (
    <section className="auth-shell">
      <div className="auth-intro center">
        <span className="auth-icon"><LogIn size={34} aria-hidden="true" /></span>
        <h1 className="title">Connexion</h1>
        <p className="subtitle">Accédez à votre espace personnel.</p>
      </div>

      <form method="post" ref={formRef} onSubmit={submit} className="card auth-card" noValidate>
        {notice && (
          <div ref={noticeRef} className="auth-notice auth-notice-error" role="alert" aria-live="polite">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>{notice.title}</strong>
              <p>{notice.description}</p>
            </div>
          </div>
        )}

        <label className="auth-field">
          <span>Email</span>
          <span className="auth-input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input className="input" name="email" type="email" autoComplete="email" disabled={isSubmitting} aria-invalid={Boolean(fieldErrors.email)} />
          </span>
          {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
        </label>

        <label className="auth-field">
          <span>Mot de passe</span>
          <span className="auth-input-wrap">
            <Lock size={18} aria-hidden="true" />
            <input className="input" name="password" type="password" autoComplete="current-password" disabled={isSubmitting} aria-invalid={Boolean(fieldErrors.password)} />
          </span>
          {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
        </label>

        <p className="auth-forgot">
          <Link href="/auth/password-forgot">Mot de passe oublié&nbsp;?</Link>
        </p>

        <button className="btn btn-primary auth-submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="action-spin" size={18} aria-hidden="true" />}
          {isSubmitting ? "Connexion..." : "Se connecter"}
        </button>

        <button
          className="btn btn-outline auth-submit"
          type="button"
          onClick={resendVerification}
          disabled={isSubmitting || resendStatus === "submitting"}
        >
          {resendStatus === "submitting" ? "Envoi…" : "Renvoyer l’e-mail de confirmation"}
        </button>
        {resendStatus === "success" && (
          <div className="auth-notice auth-notice-success" role="status" aria-live="polite">
            <CheckCircle2 size={20} aria-hidden="true" />
            <div><strong>Demande prise en compte</strong><p>Si ce compte attend une confirmation, un nouveau lien vient d’être envoyé.</p></div>
          </div>
        )}
        {resendStatus === "error" && !fieldErrors.email && (
          <div className="auth-notice auth-notice-error" role="alert" aria-live="polite">
            <AlertTriangle size={20} aria-hidden="true" />
            <div><strong>Envoi indisponible</strong><p>Réessayez dans quelques instants.</p></div>
          </div>
        )}

        <p className="auth-switch">
          Pas encore de compte ? <Link href={signupHref}><strong>S'inscrire</strong></Link>
        </p>
      </form>

      <Link className="auth-back" href="/">← Retour à l'accueil</Link>
    </section>
  );
}
