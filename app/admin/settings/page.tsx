"use client";

import { CheckCircle2, Save, ShieldCheck, TestTube2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";
import type { Course } from "@/lib/types";

type Settings = {
  rib: string;
  iban: string;
  bic: string;
  beneficiary: string;
  adminEmail: string;
  paypalUrl: string;
  lemonApiKey: string;
  lemonApiKeyConfigured?: boolean;
  lemonApiKeyPreview?: string;
  lemonSigningSecret: string;
  lemonSigningSecretConfigured?: boolean;
  lemonSigningSecretPreview?: string;
  lemonWebhookUrl: string;
  lemonStoreId: string;
  lemonDefaultVariantId: string;
  lemonVariantMap: Record<string, string>;
};

type LemonTestResult = {
  ok: boolean;
  error?: string;
  storeCount?: number;
  variantCount?: number;
  suggestedStoreId?: string;
  variants?: { id?: string; name?: string; status?: string; price?: string | number }[];
};

const emptySettings: Settings = {
  rib: "",
  iban: "",
  bic: "",
  beneficiary: "",
  adminEmail: "",
  paypalUrl: "",
  lemonApiKey: "",
  lemonSigningSecret: "",
  lemonWebhookUrl: "https://irenee-institut.org/lemonpay",
  lemonStoreId: "",
  lemonDefaultVariantId: "",
  lemonVariantMap: {}
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [courses, setCourses] = useState<Course[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [testStatus, setTestStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<LemonTestResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(response => response.json()),
      fetch("/api/courses").then(response => response.json()).catch(() => [])
    ])
      .then(([data, courseRows]) => {
        setSettings(current => ({
          ...current,
          ...data,
          lemonApiKey: "",
          lemonSigningSecret: "",
          lemonVariantMap: data.lemonVariantMap && typeof data.lemonVariantMap === "object" ? data.lemonVariantMap : {}
        }));
        setCourses(Array.isArray(courseRows) ? courseRows : []);
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
      paypalUrl: settings.paypalUrl,
      lemonApiKey: settings.lemonApiKey,
      lemonSigningSecret: settings.lemonSigningSecret,
      lemonWebhookUrl: settings.lemonWebhookUrl,
      lemonStoreId: settings.lemonStoreId,
      lemonDefaultVariantId: settings.lemonDefaultVariantId,
      lemonVariantMap: settings.lemonVariantMap
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
          lemonApiKey: "",
          lemonSigningSecret: "",
          lemonVariantMap: refreshed.lemonVariantMap && typeof refreshed.lemonVariantMap === "object" ? refreshed.lemonVariantMap : current.lemonVariantMap
        }));
      }
    } else {
      setError(data.error || "Les paramètres n'ont pas pu être enregistrés.");
      setStatus("error");
    }
  }

  async function testLemon() {
    setTestStatus("saving");
    setTestResult(null);
    const response = await fetch("/api/payments/lemon/test");
    const data = await response.json().catch(() => null);
    setTestResult(data);
    if (response.ok && data?.ok) {
      setTestStatus("success");
      if (!settings.lemonStoreId && data.suggestedStoreId) {
        update("lemonStoreId", data.suggestedStoreId);
      }
    } else {
      setTestStatus("error");
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(current => ({ ...current, [key]: value }));
  }

  function updateVariant(course: Course, value: string) {
    setSettings(current => ({
      ...current,
      lemonVariantMap: {
        ...current.lemonVariantMap,
        [course.id]: value.trim()
      }
    }));
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 980 }}>
        <a href="/admin">← Retour au tableau de bord</a>
        <h1 className="title" style={{ marginTop: 28 }}>Paramètres</h1>
        <form className="card" style={{ padding: 30, marginTop: 30 }} onSubmit={submit}>
          <h2 className="font-display" style={{ color: "var(--navy)" }}>Informations de paiement</h2>
          <p><label>RIB affiché aux étudiants</label><input className="input" name="rib" value={settings.rib} onChange={event => update("rib", event.target.value)} placeholder="FR76..." /></p>
          <p><label>IBAN</label><input className="input" name="iban" value={settings.iban} onChange={event => update("iban", event.target.value)} placeholder="FR76..." /></p>
          <p><label>BIC</label><input className="input" name="bic" value={settings.bic} onChange={event => update("bic", event.target.value)} /></p>
          <p><label>Nom du bénéficiaire</label><input className="input" name="beneficiary" value={settings.beneficiary} onChange={event => update("beneficiary", event.target.value)} /></p>
          <p><label>Email administratif</label><input className="input" name="adminEmail" value={settings.adminEmail} onChange={event => update("adminEmail", event.target.value)} /></p>
          <p><label>URL PayPal par défaut</label><input className="input" name="paypalUrl" value={settings.paypalUrl} onChange={event => update("paypalUrl", event.target.value)} placeholder="https://paypal.me/..." /></p>

          <div className="settings-panel">
            <div className="course-editor-head">
              <div>
                <span className="badge"><ShieldCheck size={14} /> Paiement</span>
                <h2 className="font-display">Paiement en ligne</h2>
              </div>
              <button className="btn btn-outline" type="button" onClick={testLemon} disabled={testStatus === "saving"}>
                <TestTube2 size={18} /> {testStatus === "saving" ? "Vérification..." : "Vérifier"}
              </button>
            </div>

            <div className="grid-2">
              <p>
                <label>Clé de connexion au paiement</label>
                <input
                  className="input"
                  type="password"
                  value={settings.lemonApiKey}
                  onChange={event => update("lemonApiKey", event.target.value)}
                  placeholder={settings.lemonApiKeyConfigured ? "Clé déjà enregistrée" : "Coller la clé fournie"}
                  autoComplete="off"
                />
                {settings.lemonApiKeyConfigured && <small className="auth-help">Clé déjà enregistrée. Laissez vide pour la conserver.</small>}
              </p>
              <p>
                <label>Secret de validation</label>
                <input
                  className="input"
                  type="password"
                  value={settings.lemonSigningSecret}
                  onChange={event => update("lemonSigningSecret", event.target.value)}
                  placeholder={settings.lemonSigningSecretConfigured ? "Secret déjà enregistré" : "Coller le secret fourni"}
                  autoComplete="off"
                />
                {settings.lemonSigningSecretConfigured && <small className="auth-help">Secret déjà enregistré. Laissez vide pour le conserver.</small>}
              </p>
            </div>

            <div className="grid-3">
              <p><label>Adresse de confirmation</label><input className="input" value={settings.lemonWebhookUrl} onChange={event => update("lemonWebhookUrl", event.target.value)} /></p>
              <p><label>Compte vendeur</label><input className="input" value={settings.lemonStoreId} onChange={event => update("lemonStoreId", event.target.value)} placeholder="Ex: 12345" /></p>
              <p><label>Produit par défaut</label><input className="input" value={settings.lemonDefaultVariantId} onChange={event => update("lemonDefaultVariantId", event.target.value)} placeholder="Optionnel" /></p>
            </div>

            <div className="variant-grid">
              {courses.map(course => (
                <label className="variant-row" key={course.id}>
                  <span>
                    <strong>{course.titre}</strong>
                    <small>{course.slug}</small>
                  </span>
                  <input className="input" value={settings.lemonVariantMap[course.id] || ""} onChange={event => updateVariant(course, event.target.value)} placeholder="Référence produit" />
                </label>
              ))}
              {!courses.length && <p className="muted">Aucune formation trouvée pour associer les produits.</p>}
            </div>

            <ActionNotice
              status={testStatus}
              success={`Connexion au service de paiement validée${testResult?.variantCount !== undefined ? ` · ${testResult.variantCount} produit(s) détecté(s)` : ""}.`}
              error={testResult?.error || "La vérification du paiement a échoué."}
            />

            {testResult?.variants?.length ? (
              <div className="soft-card lemon-variant-list">
                <h3>Produits détectés</h3>
                {testResult.variants.map(variant => (
                  <p key={variant.id}>
                    <CheckCircle2 size={15} /> <strong>{variant.id}</strong> · {variant.name || "Sans nom"} · {variant.price || "prix indisponible"}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <ActionNotice status={status} success="Paramètres enregistrés." error={error} />
          <p><button className="btn btn-primary"><Save size={18} /> Enregistrer</button></p>
        </form>
      </div>
    </section>
  );
}
