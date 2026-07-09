"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, Search, ShieldAlert } from "lucide-react";

type VerificationResult = {
  valid: boolean;
  error?: string;
  document?: {
    courseTitle?: string | null;
    issuedAt: string;
    kind: string;
    moduleTitle?: string | null;
    reference: string;
  };
};

export function DocumentVerificationForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [result, setResult] = useState<VerificationResult | null>(null);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("loading");
    setResult(null);
    const response = await fetch("/api/documents/verify", {
      body: JSON.stringify({ recipient: form.get("recipient"), reference: form.get("reference") }),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }).catch(() => null);
    const data = await response?.json().catch(() => null) as VerificationResult | null;
    setResult(data);
    setStatus(response?.ok && data?.valid ? "valid" : "invalid");
  }

  return (
    <form className="card auth-card" onSubmit={verify}>
      <label className="auth-field">
        <span>Référence du document</span>
        <input className="input" name="reference" placeholder="ISI-…" autoCapitalize="characters" maxLength={24} required />
      </label>
      <label className="auth-field">
        <span>Nom complet exactement affiché</span>
        <input className="input" name="recipient" autoComplete="name" maxLength={240} required />
      </label>
      <button className="btn btn-primary auth-submit" disabled={status === "loading"}>
        {status === "loading" ? <Loader2 className="action-spin" size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
        {status === "loading" ? "Vérification…" : "Vérifier le document"}
      </button>
      {status === "valid" && result?.document && (
        <div className="auth-notice auth-notice-success" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          <div>
            <strong>Document émis par la plateforme</strong>
            <p>Référence {result.document.reference}, émise le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(result.document.issuedAt))}.</p>
          </div>
        </div>
      )}
      {status === "invalid" && (
        <div className="auth-notice auth-notice-error" role="alert">
          <ShieldAlert size={20} aria-hidden="true" />
          <div>
            <strong>Correspondance introuvable</strong>
            <p>{result?.error || "La référence et le nom déclaré ne correspondent pas à un document émis."}</p>
          </div>
        </div>
      )}
    </form>
  );
}
