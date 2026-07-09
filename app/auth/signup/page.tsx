"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Mail, UserPlus, UserRound } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { translateAuthError, type AuthErrorCopy } from "@/lib/auth-errors";
import { safeInternalPath } from "@/lib/request-security";
import { annualPassCheckoutPath, cleanAnnualPassSignupPath } from "@/lib/routes";
import { createBrowserClient } from "@/lib/supabase";

type FieldErrors = Partial<Record<"prenom" | "nom" | "email", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFieldValue(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

function getSafeNextPath() {
  if (typeof window === "undefined") return "/espace-etudiant";
  if (window.location.pathname === cleanAnnualPassSignupPath) return annualPassCheckoutPath;
  return safeInternalPath(new URLSearchParams(window.location.search).get("next"), "/espace-etudiant");
}

function validationNotice(errors: FieldErrors) {
  const messages = Object.values(errors).filter(Boolean);
  return messages.length ? messages.join(" ") : "Corrigez les champs marqués avant de créer le compte.";
}

export default function SignupPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [notice, setNotice] = useState<AuthErrorCopy | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loginHref, setLoginHref] = useState("/auth/login");
  const noticeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const next = getSafeNextPath();
    setLoginHref(next === "/espace-etudiant" ? "/auth/login" : `/auth/login?next=${encodeURIComponent(next)}`);
  }, []);

  useEffect(() => {
    if (!notice || status === "submitting") return;
    noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [notice, status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    const form = new FormData(formElement);
    const prenom = getFieldValue(form, "prenom");
    const nom = getFieldValue(form, "nom");
    const email = getFieldValue(form, "email").toLowerCase();
    const nextFieldErrors: FieldErrors = {};

    if (!prenom) nextFieldErrors.prenom = "Indiquez votre prénom.";
    if (!nom) nextFieldErrors.nom = "Indiquez votre nom.";
    if (!emailPattern.test(email)) nextFieldErrors.email = "Indiquez une adresse email valide.";

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setNotice({
        title: "Informations à corriger",
        description: validationNotice(nextFieldErrors),
        field: "form"
      });
      setStatus("error");
      const firstInvalidField = Object.keys(nextFieldErrors)[0];
      formElement.querySelector<HTMLInputElement>(`[name="${firstInvalidField}"]`)?.focus();
      return;
    }

    setFieldErrors({});
    setNotice(null);
    setStatus("submitting");

    const supabase = createBrowserClient();
    if (!supabase) {
      setStatus("error");
      setNotice({
        title: "Inscription indisponible",
        description: "La création de compte est momentanément indisponible. Réessayez dans quelques instants.",
        field: "form"
      });
      return;
    }

    await supabase.auth.signOut();

    const { data, error } = await supabase.auth.signUp({
      email,
      options: {
        data: { prenom, nom },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeNextPath())}`
      }
    });

    if (error) {
      const translated = translateAuthError(error.message, "Le compte n'a pas pu être créé.");
      setNotice(translated);
      setStatus("error");
      if (translated.field === "email") setFieldErrors({ email: translated.description });
      return;
    }

    setStatus("success");
    setNotice({
      title: "Compte créé, confirmation à faire",
      description: "Si cette adresse doit être confirmée, un lien vient d'être envoyé. Ouvrez-le pour choisir votre mot de passe et activer le compte.",
      field: "form"
    });
    formElement.reset();
  }

  const isSubmitting = status === "submitting";
  const isSuccess = status === "success";

  return (
    <section className="auth-shell">
      <div className="auth-intro center">
        <span className="auth-icon"><UserPlus size={34} aria-hidden="true" /></span>
        <h1 className="title">Créer mon compte</h1>
        <p className="subtitle">Accédez aux formations et à votre espace étudiant.</p>
      </div>

      <form onSubmit={submit} className="card auth-card" noValidate>
        {notice && (
          <div ref={noticeRef} className={`auth-notice ${isSuccess ? "auth-notice-success" : "auth-notice-error"}`} role={isSuccess ? "status" : "alert"} aria-live="polite">
            {isSuccess ? <CheckCircle2 size={20} aria-hidden="true" /> : <AlertTriangle size={20} aria-hidden="true" />}
            <div>
              <strong>{notice.title}</strong>
              <p>{notice.description}</p>
            </div>
          </div>
        )}

        <div className="grid-2">
          <label className="auth-field">
            <span>Prénom</span>
            <span className="auth-input-wrap">
              <UserRound size={18} aria-hidden="true" />
              <input className="input" name="prenom" autoComplete="given-name" disabled={isSubmitting || isSuccess} aria-invalid={Boolean(fieldErrors.prenom)} />
            </span>
            {fieldErrors.prenom && <small className="field-error">{fieldErrors.prenom}</small>}
          </label>

          <label className="auth-field">
            <span>Nom</span>
            <span className="auth-input-wrap">
              <UserRound size={18} aria-hidden="true" />
              <input className="input" name="nom" autoComplete="family-name" disabled={isSubmitting || isSuccess} aria-invalid={Boolean(fieldErrors.nom)} />
            </span>
            {fieldErrors.nom && <small className="field-error">{fieldErrors.nom}</small>}
          </label>
        </div>

        <label className="auth-field">
          <span>Email</span>
          <span className="auth-input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input className="input" name="email" type="email" autoComplete="email" disabled={isSubmitting || isSuccess} aria-invalid={Boolean(fieldErrors.email)} />
          </span>
          {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
        </label>

        <button className="btn btn-primary auth-submit" disabled={isSubmitting || isSuccess}>
          {isSubmitting && <Loader2 className="action-spin" size={18} aria-hidden="true" />}
          {isSubmitting ? "Création du compte..." : isSuccess ? "Compte envoyé" : "Créer mon compte"}
        </button>

        <p className="auth-switch">
          Déjà un compte ? <Link href={loginHref}><strong>Se connecter</strong></Link>
        </p>
      </form>

      <Link className="auth-back" href="/">← Retour à l'accueil</Link>
    </section>
  );
}
