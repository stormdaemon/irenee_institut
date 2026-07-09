"use client";

import { CheckCircle2, Save, ShieldCheck, TestTube2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

type Settings = {
  rib: string;
  iban: string;
  bic: string;
  beneficiary: string;
  adminEmail: string;
  googleAppsScriptMailSecret: string;
  googleAppsScriptMailSecretConfigured?: boolean;
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
  stripeApiVersion: string;
  stripeLiteWebhookSecret: string;
  stripeLiteWebhookSecretConfigured?: boolean;
  stripeLiteWebhookUrl: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
  stripeSecretKeyConfigured?: boolean;
  stripeWebhookSecret: string;
  stripeWebhookSecretConfigured?: boolean;
  stripeWebhookUrl: string;
};

type StripeTestResult = {
  ok: boolean;
  apiVersion?: string;
  error?: string;
  liteWebhookConfigured?: boolean;
  webhookConfigured?: boolean;
};

const emptySettings: Settings = {
  rib: "",
  iban: "",
  bic: "",
  beneficiary: "",
  adminEmail: "",
  googleAppsScriptMailSecret: "",
  paypalAppName: "irenee_institut",
  paypalClientId: "",
  paypalClientSecret: "",
  paypalWebhookUrl: "https://irenee-institut.org/paypal_checkout_valid",
  paypalWebhookId: "",
  paypalEnvironment: "live",
  paypalDefaultAmountCents: 9900,
  stripeApiVersion: "2022-11-15",
  stripeLiteWebhookSecret: "",
  stripeLiteWebhookUrl: "https://irenee-institut.org/stripe_webhook_lite",
  stripePublishableKey: "",
  stripeSecretKey: "",
  stripeWebhookSecret: "",
  stripeWebhookUrl: "https://irenee-institut.org/stripe_webhook"
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [testStatus, setTestStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<StripeTestResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    authenticatedFetch("/api/settings")
      .then(response => response.json())
      .then(data => {
        setSettings(current => ({
          ...current,
          ...data,
          paypalClientId: "",
          paypalClientSecret: "",
          paypalWebhookId: "",
          googleAppsScriptMailSecret: "",
          paypalEnvironment: data.paypalEnvironment === "sandbox" ? "sandbox" : "live",
          paypalDefaultAmountCents: Number(data.paypalDefaultAmountCents || 9900),
          stripeApiVersion: data.stripeApiVersion || "2022-11-15",
          stripeLiteWebhookSecret: "",
          stripeSecretKey: "",
          stripeWebhookSecret: ""
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
      googleAppsScriptMailSecret: settings.googleAppsScriptMailSecret,
      paypalAppName: settings.paypalAppName,
      paypalClientId: settings.paypalClientId,
      paypalClientSecret: settings.paypalClientSecret,
      paypalWebhookUrl: settings.paypalWebhookUrl,
      paypalWebhookId: settings.paypalWebhookId,
      paypalEnvironment: settings.paypalEnvironment,
      paypalDefaultAmountCents: settings.paypalDefaultAmountCents,
      stripeApiVersion: settings.stripeApiVersion,
      stripeLiteWebhookSecret: settings.stripeLiteWebhookSecret,
      stripeLiteWebhookUrl: settings.stripeLiteWebhookUrl,
      stripePublishableKey: settings.stripePublishableKey,
      stripeSecretKey: settings.stripeSecretKey,
      stripeWebhookSecret: settings.stripeWebhookSecret,
      stripeWebhookUrl: settings.stripeWebhookUrl
    };

    const response = await authenticatedFetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.ok && data.verified === true) {
      setStatus("success");
      const refreshed = await authenticatedFetch("/api/settings").then(result => result.json()).catch(() => null);
      if (refreshed) {
        setSettings(current => ({
          ...current,
          ...refreshed,
          paypalClientId: "",
          paypalClientSecret: "",
          paypalWebhookId: "",
          googleAppsScriptMailSecret: "",
          paypalEnvironment: refreshed.paypalEnvironment === "sandbox" ? "sandbox" : "live",
          stripeLiteWebhookSecret: "",
          stripeSecretKey: "",
          stripeWebhookSecret: ""
        }));
      }
    } else {
      setError(data.error || "Les parametres n'ont pas pu etre enregistres.");
      setStatus("error");
    }
  }

  async function testStripe() {
    setTestStatus("saving");
    setTestResult(null);
    const response = await authenticatedFetch("/api/payments/stripe/test");
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
          <p>
            <label>Secret de synchronisation Google Apps Script</label>
            <input
              className="input"
              type="password"
              value={settings.googleAppsScriptMailSecret}
              onChange={event => update("googleAppsScriptMailSecret", event.target.value)}
              placeholder={settings.googleAppsScriptMailSecretConfigured ? "Secret déjà enregistré" : "À renseigner lors de la configuration Google Apps Script"}
              autoComplete="off"
            />
            {settings.googleAppsScriptMailSecretConfigured && <small className="auth-help">Secret déjà enregistré. Laissez vide pour le conserver.</small>}
          </p>

          <div className="settings-panel">
            <div className="course-editor-head">
              <div>
                <span className="badge"><ShieldCheck size={14} /> Stripe</span>
                <h2 className="font-display">Paiement en ligne securise</h2>
              </div>
              <button className="btn btn-outline" type="button" onClick={testStripe} disabled={testStatus === "saving"}>
                <TestTube2 size={18} /> {testStatus === "saving" ? "Verification..." : "Verifier"}
              </button>
            </div>

            <div className="paypal-settings-note">
              <CheckCircle2 size={18} />
              <p>API Stripe : <strong>2022-11-15</strong>. Le pass annuel et l'adhesion bibliotheque sont actives automatiquement apres confirmation webhook.</p>
            </div>

            <div className="grid-2">
              <p>
                <label>Version API Stripe</label>
                <input className="input" value={settings.stripeApiVersion} onChange={event => update("stripeApiVersion", event.target.value)} />
              </p>
              <p>
                <label>Cle publique Stripe</label>
                <input className="input" value={settings.stripePublishableKey} onChange={event => update("stripePublishableKey", event.target.value)} placeholder="pk_live_..." autoComplete="off" />
              </p>
            </div>

            <p>
              <label>Cle secrete Stripe</label>
              <input
                className="input"
                type="password"
                value={settings.stripeSecretKey}
                onChange={event => update("stripeSecretKey", event.target.value)}
                placeholder={settings.stripeSecretKeyConfigured ? "Cle secrete deja enregistree" : "Coller la cle sk_live_..."}
                autoComplete="off"
              />
              {settings.stripeSecretKeyConfigured && <small className="auth-help">Cle secrete deja enregistree. Laissez vide pour la conserver.</small>}
            </p>

            <div className="grid-2">
              <p>
                <label>Adresse webhook snapshot</label>
                <input className="input" value={settings.stripeWebhookUrl} onChange={event => update("stripeWebhookUrl", event.target.value)} />
              </p>
              <p>
                <label>Secret webhook snapshot</label>
                <input
                  className="input"
                  type="password"
                  value={settings.stripeWebhookSecret}
                  onChange={event => update("stripeWebhookSecret", event.target.value)}
                  placeholder={settings.stripeWebhookSecretConfigured ? "Secret deja enregistre" : "whsec_..."}
                  autoComplete="off"
                />
                {settings.stripeWebhookSecretConfigured && <small className="auth-help">Secret deja enregistre. Laissez vide pour le conserver.</small>}
              </p>
            </div>

            <div className="grid-2">
              <p>
                <label>Adresse webhook leger</label>
                <input className="input" value={settings.stripeLiteWebhookUrl} onChange={event => update("stripeLiteWebhookUrl", event.target.value)} />
              </p>
              <p>
                <label>Secret webhook leger</label>
                <input
                  className="input"
                  type="password"
                  value={settings.stripeLiteWebhookSecret}
                  onChange={event => update("stripeLiteWebhookSecret", event.target.value)}
                  placeholder={settings.stripeLiteWebhookSecretConfigured ? "Secret deja enregistre" : "whsec_..."}
                  autoComplete="off"
                />
                {settings.stripeLiteWebhookSecretConfigured && <small className="auth-help">Secret deja enregistre. Laissez vide pour le conserver.</small>}
              </p>
            </div>

            <ActionNotice
              status={testStatus}
              success={`Connexion Stripe validee${testResult?.webhookConfigured && testResult?.liteWebhookConfigured ? " avec webhooks configures" : ""}.`}
              error={testResult?.error || "La verification Stripe a echoue."}
            />
          </div>

          <ActionNotice status={status} success="Parametres enregistres." error={error} />
          <p><button className="btn btn-primary"><Save size={18} /> Enregistrer</button></p>
        </form>
      </div>
    </section>
  );
}
