"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Lock, Mail, UserPlus, UserRound } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { translateAuthError, type AuthErrorCopy } from "@/lib/auth-errors";
import { createBrowserClient } from "@/lib/supabase";

type FieldErrors = Partial<Record<"prenom" | "nom" | "email" | "password" | "passwordConfirm", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFieldValue(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

function getSafeNextPath() {
  if (typeof window === "undefined") return "/espace-etudiant";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/espace-etudiant";
}

export default function SignupPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [notice, setNotice] = useState<AuthErrorCopy | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const noticeRef = useRef<HTMLDivElement | null>(null);

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
    const password = String(form.get("password") || "");
    const passwordConfirm = String(form.get("passwordConfirm") || "");
    const marketingOptIn = form.get("marketing_opt_in") === "on";
    const nextFieldErrors: FieldErrors = {};

    if (!prenom) nextFieldErrors.prenom = "Indiquez votre prénom.";
    if (!nom) nextFieldErrors.nom = "Indiquez votre nom.";
    if (!emailPattern.test(email)) nextFieldErrors.email = "Indiquez une adresse email valide.";
    if (password.length < 8) nextFieldErrors.password = "Le mot de passe doit contenir au moins 8 caractères.";
    if (password !== passwordConfirm) nextFieldErrors.passwordConfirm = "Les deux mots de passe ne correspondent pas.";

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setNotice({
        title: "Informations à corriger",
        description: "Les champs marqués doivent être corrigés avant de créer le compte.",
        field: "form"
      });
      setStatus("error");
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
      options: {
        data: { prenom, nom, marketing_opt_in: marketingOptIn },
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

    if (!data.user?.id) {
      setNotice({
        title: "Inscription incomplète",
        description: "Le compte n'a pas pu être créé complètement. Réessayez dans quelques instants.",
        field: "form"
      });
      setStatus("error");
      return;
    }

    if (data.user.identities && data.user.identities.length === 0) {
      await supabase.auth.signOut();
      setNotice({
        title: "Cette adresse est déjà connue",
        description: "Un compte existe déjà pour cet email, ou une confirmation est déjà en attente. Connectez-vous, ou confirmez l'email reçu avant de réessayer.",
        field: "email"
      });
      setFieldErrors({ email: "Cette adresse est déjà associée à un compte ou à une confirmation en attente." });
      setStatus("error");
      return;
    }

    if (data.session?.access_token) {
      const profileResponse = await fetch("/api/inscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`
        },
        body: JSON.stringify({
          user_id: data.user.id,
          email,
          prenom,
          nom,
          marketing_opt_in: marketingOptIn,
          statut_inscription: "en_attente"
        })
      });
      const profileResult = await profileResponse.json().catch(() => null);

      if (!profileResponse.ok || profileResult?.verified !== true) {
        await supabase.auth.signOut();
        setNotice({
          title: "Compte créé, finalisation impossible",
          description: profileResult?.error || "Le compte a été créé, mais votre espace n'a pas pu être préparé.",
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
          title: "Compte créé, espace indisponible",
          description: meResult?.error || "Le compte est connecté, mais l'espace étudiant n'a pas pu être chargé.",
          field: "form"
        });
        setStatus("error");
        return;
      }

      window.location.href = getSafeNextPath();
      return;
    }

    setStatus("success");
    setNotice({
      title: "Compte créé, confirmation à faire",
      description: "Nous avons envoyé un email de confirmation. Ouvrez ce message pour activer votre compte avant de vous connecter.",
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

        <label className="auth-field">
          <span>Mot de passe</span>
          <span className="auth-input-wrap">
            <Lock size={18} aria-hidden="true" />
            <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} disabled={isSubmitting || isSuccess} aria-invalid={Boolean(fieldErrors.password)} />
          </span>
          {fieldErrors.password ? <small className="field-error">{fieldErrors.password}</small> : <small className="auth-help">Minimum 8 caractères.</small>}
        </label>

        <label className="auth-field">
          <span>Confirmer le mot de passe</span>
          <span className="auth-input-wrap">
            <Lock size={18} aria-hidden="true" />
            <input className="input" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} disabled={isSubmitting || isSuccess} aria-invalid={Boolean(fieldErrors.passwordConfirm)} />
          </span>
          {fieldErrors.passwordConfirm && <small className="field-error">{fieldErrors.passwordConfirm}</small>}
        </label>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input name="marketing_opt_in" type="checkbox" defaultChecked disabled={isSubmitting || isSuccess} style={{ marginTop: 4 }} />
          <span>
            Recevoir les actualités importantes, ressources et offres de formations de l'Institut Irénée.
            <small className="auth-help" style={{ display: "block" }}>Lettre hebdomadaire. Désabonnement possible à tout moment.</small>
          </span>
        </label>

        <button className="btn btn-primary auth-submit" disabled={isSubmitting || isSuccess}>
          {isSubmitting && <Loader2 className="action-spin" size={18} aria-hidden="true" />}
          {isSubmitting ? "Création du compte..." : isSuccess ? "Compte envoyé" : "Créer mon compte"}
        </button>

        <p className="auth-switch">
          Déjà un compte ? <Link href="/auth/login"><strong>Se connecter</strong></Link>
        </p>
      </form>

      <Link className="auth-back" href="/">← Retour à l'accueil</Link>
    </section>
  );
}
