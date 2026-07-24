"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Lock, Mail, Phone, UserPlus, UserRound } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { translateAuthError, type AuthErrorCopy } from "@/lib/auth-errors";
import { safeInternalPath } from "@/lib/request-security";
import { annualPassCheckoutPath, cleanAnnualPassSignupPath } from "@/lib/routes";
import { createBrowserClient } from "@/lib/supabase";

type FieldErrors = Partial<Record<"prenom" | "nom" | "telephone" | "email" | "password" | "passwordConfirm", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9 ()\-.]{6,30}$/;

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
    const telephone = getFieldValue(form, "telephone");
    const email = getFieldValue(form, "email").toLowerCase();
    const password = String(form.get("password") || "");
    const passwordConfirm = String(form.get("passwordConfirm") || "");
    const nextFieldErrors: FieldErrors = {};

    if (!prenom) nextFieldErrors.prenom = "Indiquez votre prénom.";
    if (!nom) nextFieldErrors.nom = "Indiquez votre nom.";
    if (!telephone) nextFieldErrors.telephone = "Indiquez votre numéro de téléphone.";
    else if (!phonePattern.test(telephone)) nextFieldErrors.telephone = "Indiquez un numéro de téléphone valide.";
    if (!emailPattern.test(email)) nextFieldErrors.email = "Indiquez une adresse email valide.";
    if (password.length < 12) nextFieldErrors.password = "Le mot de passe doit contenir au moins 12 caractères.";
    if (password !== passwordConfirm) nextFieldErrors.passwordConfirm = "Les deux mots de passe ne correspondent pas.";

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
      password,
      passwordConfirmation: passwordConfirm,
      options: {
        data: { prenom, nom, telephone },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeNextPath())}`
      }
    });

    if (error) {
      const translated = translateAuthError(error.message, "Le compte n'a pas pu être créé.");
      setNotice(translated);
      setStatus("error");
      if (translated.field === "email") setFieldErrors({ email: translated.description });
      if (translated.field === "password") setFieldErrors({ password: translated.description });
      return;
    }

    if (!data.user?.id || !data.session) {
      setNotice({
        title: "Inscription incomplète",
        description: "Le compte n'a pas pu être créé complètement. Réessayez dans quelques instants.",
        field: "form"
      });
      setStatus("error");
      return;
    }

    setStatus("success");
    window.location.replace(getSafeNextPath());
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

        <label className="auth-field">
          <span>Téléphone</span>
          <span className="auth-input-wrap">
            <Phone size={18} aria-hidden="true" />
            <input className="input" name="telephone" type="tel" autoComplete="tel" inputMode="tel" maxLength={30} disabled={isSubmitting || isSuccess} aria-invalid={Boolean(fieldErrors.telephone)} />
          </span>
          {fieldErrors.telephone && <small className="field-error">{fieldErrors.telephone}</small>}
        </label>

        <label className="auth-field">
          <span>Mot de passe</span>
          <span className="auth-input-wrap">
            <Lock size={18} aria-hidden="true" />
            <input className="input" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(fieldErrors.password)} />
          </span>
          {fieldErrors.password ? <small className="field-error">{fieldErrors.password}</small> : <small className="auth-help">12 caractères minimum.</small>}
        </label>

        <label className="auth-field">
          <span>Confirmer le mot de passe</span>
          <span className="auth-input-wrap">
            <Lock size={18} aria-hidden="true" />
            <input className="input" name="passwordConfirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(fieldErrors.passwordConfirm)} />
          </span>
          {fieldErrors.passwordConfirm && <small className="field-error">{fieldErrors.passwordConfirm}</small>}
        </label>

        <button className="btn btn-primary auth-submit" disabled={isSubmitting || isSuccess}>
          {isSubmitting && <Loader2 className="action-spin" size={18} aria-hidden="true" />}
          {isSubmitting ? "Création du compte..." : isSuccess ? "Compte créé" : "Créer mon compte"}
        </button>

        <p className="auth-switch">
          Déjà un compte ? <Link href={loginHref}><strong>Se connecter</strong></Link>
        </p>
      </form>

      <Link className="auth-back" href="/">← Retour à l'accueil</Link>
    </section>
  );
}
