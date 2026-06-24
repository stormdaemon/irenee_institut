"use client";

import Link from "next/link";
import { AlertTriangle, Loader2, Lock, LogIn, Mail } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { translateAuthError, type AuthErrorCopy } from "@/lib/auth-errors";
import { createBrowserClient } from "@/lib/supabase";

type FieldErrors = Partial<Record<"email" | "password", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSafeNextPath() {
  if (typeof window === "undefined") return "/espace-etudiant";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/espace-etudiant";
}

export default function LoginPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [notice, setNotice] = useState<AuthErrorCopy | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [signupHref, setSignupHref] = useState("/auth/signup");
  const noticeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const next = getSafeNextPath();
    setSignupHref(next === "/espace-etudiant" ? "/auth/signup" : `/auth/signup?next=${encodeURIComponent(next)}`);
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

    if (!data.session?.access_token || !data.user) {
      setNotice({
        title: "Connexion non confirmée",
        description: "Vérifiez que votre email est confirmé et que le mot de passe est correct.",
        field: "form"
      });
      setStatus("error");
      return;
    }

    const meResponse = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${data.session.access_token}` }
    });

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

  const isSubmitting = status === "submitting";

  return (
    <section className="auth-shell">
      <div className="auth-intro center">
        <span className="auth-icon"><LogIn size={34} aria-hidden="true" /></span>
        <h1 className="title">Connexion</h1>
        <p className="subtitle">Accédez à votre espace personnel.</p>
      </div>

      <form onSubmit={submit} className="card auth-card" noValidate>
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

        <button className="btn btn-primary auth-submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="action-spin" size={18} aria-hidden="true" />}
          {isSubmitting ? "Connexion..." : "Se connecter"}
        </button>

        <p className="auth-switch">
          Pas encore de compte ? <Link href={signupHref}><strong>S'inscrire</strong></Link>
        </p>
      </form>

      <Link className="auth-back" href="/">← Retour à l'accueil</Link>
    </section>
  );
}
