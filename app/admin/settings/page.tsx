"use client";

import { CheckCircle2, Save, ShieldCheck, TestTube2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";

type Settings = {
  rib: string;
  iban: string;
  bic: string;
  beneficiary: string;
  adminEmail: string;
  paypalAppName: string;
  paypalClientId: string;
  paypalClientIdConfigured?: boolean;
  paypalClientSecret: string;
  paypalClientSecretConfigured?: boolean;
  paypalWebhookUrl: string;
  paypalWebhookId: string;
  paypalWebhookIdConfigured?: boolean;
  paypalEnvironment: "live" | "sandbox";
  paypalDefaultAmountCents: number;
};

type PayPalTestResult = {
  ok: boolean;
  appName?: string;
  environment?: string;
  error?: string;
  webhookConfigured?: boolean;
  webhookUrl?: string;
};

const emptySettings: Settings = {
  rib: "",
  iban: "",
  bic: "",
  beneficiary: "",
  adminEmail: "",
  paypalAppName: "irenee_institut",
  paypalClientId: "",
  paypalClientSecret: "",
  paypalWebhookUrl: "https://irenee-institut.org/paypal_checkout_valid",
  paypalWebhookId: "",
  paypalEnvironment: "live",
  paypalDefaultAmountCents: 9900
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [testStatus, setTestStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<PayPalTestResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then(response => response.json())
      .then(data => {
        setSettings(current => ({
          ...current,
          ...data,
          paypalClientId: "",
          paypalClientSecret: "",
          paypalWebhookId: "",
          paypalEnvironment: data.paypalEnvironment === "sandbox" ? "sandbox" : "live",
          paypalDefaultAmountCents: Number(data.paypalDefaultAmountCents || 9900)
        }));
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    const payload = {
      rib: settings.rib,
      iban: settings.iban,
      bic: settings.bic,
      beneficiary: settings.beneficiary,
      adminEmail: settings.adminEmail,
      paypalAppName: settings.paypalAppName,
      paypalClientId: settings.paypalClientId,
      paypalClientSecret: settings.paypalClientSecret,
      paypalWebhookUrl: settings.paypalWebhookUrl,
      paypalWebhookId: settings.paypalWebhookId,
      paypalEnvironment: settings.paypalEnvironment,
      paypalDefaultAmountCents: settings.paypalDefaultAmountCents
    };

    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.ok && data.verified === true) {
      setStatus("success");
      const refreshed = await fetch("/api/settings").then(result => result.json()).catch(() => null);
      if (refreshed) {
        setSettings(current => ({
          ...current,
          ...refreshed,
          paypalClientId: "",
          paypalClientSecret: "",
          paypalWebhookId: "",
          paypalEnvironment: refreshed.paypalEnvironment === "sandbox" ? "sandbox" : "live"
        }));
      }
    } else {
      setError(data.error || "Les parametres n'ont pas pu etre enregistres.");
      setStatus("error");
    }
  }

  async function testPayPal() {
    setTestStatus("saving");
    setTestResult(null);
    const response = await fetch("/api/payments/paypal/test");
    const data = await response.json().catch(() => null);
    setTestResult(data);
    setTestStatus(response.ok && data?.ok ? "success" : "error");
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(current => ({ ...current, [key]: value }));
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 980 }}>
        <a href="/admin">Retour au tableau de bord</a>
        <h1 className="title" style={{ marginTop: 28 }}>Parametres</h1>
        <form className="card" style={{ padding: 30, marginTop: 30 }} onSubmit={submit}>
          <h2 className="font-display" style={{ color: "var(--navy)" }}>Informations de paiement</h2>
          <p><label>RIB affiche aux etudiants</label><input className="input" name="rib" value={settings.rib} onChange={event => update("rib", event.target.value)} placeholder="FR76..." /></p>
          <p><label>IBAN</label><input className="input" name="iban" value={settings.iban} onChange={event => update("iban", event.target.value)} placeholder="FR76..." /></p>
          <p><label>BIC</label><input className="input" name="bic" value={settings.bic} onChange={event => update("bic", event.target.value)} /></p>
          <p><label>Nom du beneficiaire</label><input className="input" name="beneficiary" value={settings.beneficiary} onChange={event => update("beneficiary", event.target.value)} /></p>
          <p><label>Email administratif</label><input className="input" name="adminEmail" value={settings.adminEmail} onChange={event => update("adminEmail", event.target.value)} /></p>

          <div className="settings-panel">
            <div className="course-editor-head">
              <div>
                <span className="badge"><ShieldCheck size={14} /> PayPal</span>
                <h2 className="font-display">Paiement en ligne a montant libre</h2>
              </div>
              <button className="btn btn-outline" type="button" onClick={testPayPal} disabled={testStatus === "saving"}>
                <TestTube2 size={18} /> {testStatus === "saving" ? "Verification..." : "Verifier"}
              </button>
            </div>

            <div className="paypal-settings-note">
              <CheckCircle2 size={18} />
              <p>Prix conseille par defaut : <strong>99 euros</strong>. L'etudiant peut modifier librement le montant dans la fenetre PayPal, puis la formation est attribuee automatiquement apres capture.</p>
            </div>

            <div className="grid-2">
              <p>
                <label>Nom de l'application PayPal</label>
                <input className="input" value={settings.paypalAppName} onChange={event => update("paypalAppName", event.target.value)} />
              </p>
              <p>
                <label>Environnement</label>
                <select className="input" value={settings.paypalEnvironment} onChange={event => update("paypalEnvironment", event.target.value as Settings["paypalEnvironment"])}>
                  <option value="live">Production</option>
                  <option value="sandbox">Sandbox</option>
                </select>
              </p>
            </div>

            <div className="grid-2">
              <p>
                <label>Client ID</label>
                <input
                  className="input"
                  type="password"
                  value={settings.paypalClientId}
                  onChange={event => update("paypalClientId", event.target.value)}
                  placeholder={settings.paypalClientIdConfigured ? "Client ID deja enregistre" : "Coller le Client ID PayPal"}
                  autoComplete="off"
                />
                {settings.paypalClientIdConfigured && <small className="auth-help">Client ID deja enregistre. Laissez vide pour le conserver.</small>}
              </p>
              <p>
                <label>Secret PayPal</label>
                <input
                  className="input"
                  type="password"
                  value={settings.paypalClientSecret}
                  onChange={event => update("paypalClientSecret", event.target.value)}
                  placeholder={settings.paypalClientSecretConfigured ? "Secret deja enregistre" : "Coller le secret PayPal"}
                  autoComplete="off"
                />
                {settings.paypalClientSecretConfigured && <small className="auth-help">Secret deja enregistre. Laissez vide pour le conserver.</small>}
              </p>
            </div>

            <div className="grid-2">
              <p>
                <label>Adresse webhook PayPal</label>
                <input className="input" value={settings.paypalWebhookUrl} onChange={event => update("paypalWebhookUrl", event.target.value)} />
              </p>
              <p>
                <label>ID webhook PayPal</label>
                <input
                  className="input"
                  type="password"
                  value={settings.paypalWebhookId}
                  onChange={event => update("paypalWebhookId", event.target.value)}
                  placeholder={settings.paypalWebhookIdConfigured ? "Webhook ID deja enregistre" : "Renseigne automatiquement apres creation"}
                  autoComplete="off"
                />
                {settings.paypalWebhookIdConfigured && <small className="auth-help">Webhook ID deja enregistre. Laissez vide pour le conserver.</small>}
              </p>
            </div>

            <ActionNotice
              status={testStatus}
              success={`Connexion PayPal validee${testResult?.webhookConfigured ? " avec webhook configure" : ""}.`}
              error={testResult?.error || "La verification PayPal a echoue."}
            />
          </div>

          <ActionNotice status={status} success="Parametres enregistres." error={error} />
          <p><button className="btn btn-primary"><Save size={18} /> Enregistrer</button></p>
        </form>
      </div>
    </section>
  );
}
