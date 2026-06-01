"use client";

import { BookOpen, CreditCard, Loader2, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  captureLibraryMembershipOrderAction,
  createLibraryMembershipOrderAction,
  getLibraryPayPalConfigAction
} from "@/app/actions/library";
import { buildPayPalSdkUrl } from "@/lib/paypal-sdk";
import { createBrowserClient } from "@/lib/supabase";

type PayPalActions = {
  restart?: () => void | Promise<void>;
};

type PayPalButtonsInstance = {
  close?: () => void;
  render: (selector: string) => Promise<void>;
};

export function LibraryMembershipButton() {
  const stableId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const containerId = useMemo(() => `library-paypal-buttons-${stableId}`, [stableId]);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "loading" | "capturing" | "error">("idle");

  async function startCheckout() {
    setStatus("checking");
    setError("");
    const supabase = createBrowserClient();
    if (!supabase) {
      setError("Paiement momentanement indisponible.");
      setStatus("error");
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      window.location.href = `/auth/login?next=${encodeURIComponent("/bibliotheque-apologetique")}`;
      return;
    }

    setToken(data.session.access_token);
    setOpen(true);
    const config = await getLibraryPayPalConfigAction();
    if (!config.ok || !config.clientId) {
      setError(config.error || "Le paiement PayPal n'a pas pu etre prepare.");
      setStatus("error");
      return;
    }

    setClientId(config.clientId);
    setCurrency(config.currency || "EUR");
    setStatus("ready");
  }

  function closeModal() {
    if (status === "loading" || status === "capturing") return;
    setOpen(false);
    setError("");
    setStatus("idle");
  }

  useEffect(() => {
    if (!open || !clientId) return;
    const scriptId = "paypal-js-sdk";
    const src = buildPayPalSdkUrl({ clientId, currency });
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existing && existing.dataset.paypalSrc !== src) {
      existing.remove();
      delete window.paypal;
    }

    if (window.paypal && document.getElementById(scriptId)) {
      setSdkReady(true);
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = src;
    script.async = true;
    script.dataset.paypalSrc = src;
    script.onload = () => setSdkReady(true);
    script.onerror = () => {
      setError("Le module PayPal n'a pas pu etre charge.");
      setStatus("error");
    };
    document.body.appendChild(script);
  }, [clientId, currency, open]);

  useEffect(() => {
    if (!open || !sdkReady || !token || !window.paypal) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    let buttons: PayPalButtonsInstance | null = null;

    try {
      buttons = window.paypal.Buttons({
        style: { shape: "rect", layout: "vertical", color: "gold", label: "paypal" },
        createOrder: async () => {
          setStatus("loading");
          const result = await createLibraryMembershipOrderAction({ origin: window.location.origin, token });
          if (result.alreadyActive && result.redirectUrl) {
            window.location.href = result.redirectUrl;
            return "";
          }
          if (!result.ok || !result.orderId) throw new Error(result.error || "Commande PayPal indisponible.");
          setStatus("ready");
          return result.orderId;
        },
        onApprove: async (data: { orderID?: string }, actions: PayPalActions) => {
          if (!data.orderID) throw new Error("Reference de commande PayPal absente.");
          setStatus("capturing");
          const result = await captureLibraryMembershipOrderAction({ orderId: data.orderID, token });
          if (!result.ok) {
            if (result.recoverable && actions.restart) {
              await actions.restart();
              setStatus("ready");
              return;
            }
            throw new Error(result.error || "Le paiement n'a pas pu etre confirme.");
          }
          window.location.href = result.redirectUrl || "/espace-etudiant";
        },
        onCancel: () => {
          setStatus("ready");
          setError("Paiement annule. Vous pouvez le relancer quand vous voulez.");
        },
        onError: (paypalError: unknown) => {
          setError(paypalError instanceof Error ? paypalError.message : "Le paiement PayPal a echoue.");
          setStatus("error");
        }
      });
      buttons.render(`#${containerId}`);
    } catch (paypalError) {
      setError(paypalError instanceof Error ? paypalError.message : "Le bouton PayPal n'a pas pu etre affiche.");
      setStatus("error");
    }

    return () => {
      container.innerHTML = "";
      buttons?.close?.();
    };
  }, [containerId, open, sdkReady, token]);

  return (
    <span className="buy-course">
      <button className="btn btn-gold" type="button" onClick={startCheckout} disabled={status === "checking" || status === "loading" || status === "capturing"}>
        {status === "checking" || status === "loading" || status === "capturing" ? <Loader2 className="action-spin" size={18} /> : <BookOpen size={18} />}
        Adhérer pour 15 EUR
      </button>
      {error && !open && <small className="field-error" role="alert">{error}</small>}
      {open && createPortal((
        <div className="modal-backdrop paypal-checkout-backdrop" role="presentation">
          <div className="modal-card paypal-checkout-modal" role="dialog" aria-modal="true" aria-labelledby={`${containerId}-title`}>
            <div className="paypal-modal-header">
              <div>
                <span className="badge"><CreditCard size={14} /> PayPal</span>
                <h2 id={`${containerId}-title`} className="font-display">Adhésion bibliothèque</h2>
              </div>
              <button className="modal-close" type="button" onClick={closeModal} aria-label="Fermer le paiement"><X size={18} /></button>
            </div>
            <p className="paypal-checkout-intro">
              L'adhésion annuelle à la bibliothèque d'école apologétique est fixée à 15 EUR.
              Une fois le paiement confirmé, vous pourrez demander le livre de votre choix depuis votre espace étudiant.
            </p>
            <div className="paypal-membership-price"><strong>15 EUR</strong><span>Adhésion annuelle</span></div>
            <div className="paypal-buttons-frame" id={containerId}>
              {!sdkReady && status !== "error" ? <p><Loader2 className="action-spin" size={18} /> Chargement PayPal...</p> : null}
            </div>
            {status === "capturing" && <p className="muted">Activation de votre accès bibliothèque...</p>}
            {error && <small className="field-error" role="alert">{error}</small>}
          </div>
        </div>
      ), document.body)}
    </span>
  );
}
