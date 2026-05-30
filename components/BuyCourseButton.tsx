"use client";

import { BookOpen, CreditCard, Loader2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { capturePayPalOrderAction, createPayPalOrderAction, getPayPalCheckoutConfigAction } from "@/app/actions/payments";
import { createBrowserClient } from "@/lib/supabase";

type BuyCourseButtonProps = {
  courseId: string;
  courseTitle?: string;
  defaultAmountCents?: number;
  label?: string;
  className?: string;
};

type PayPalConfig = {
  clientId: string;
  currency: string;
  defaultAmount: string;
};

type PayPalActions = {
  restart?: () => void | Promise<void>;
};

type PayPalButtonsInstance = {
  close?: () => void;
  render: (selector: string) => Promise<void>;
};

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID?: string }, actions: PayPalActions) => Promise<void>;
        onCancel?: () => void;
        onError?: (error: unknown) => void;
        style?: Record<string, string>;
      }) => PayPalButtonsInstance;
    };
  }
}

export function BuyCourseButton({
  courseId,
  courseTitle = "cette formation",
  defaultAmountCents = 9900,
  label = "Paiement libre",
  className = "btn btn-primary"
}: BuyCourseButtonProps) {
  const stableId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const paypalContainerId = useMemo(() => `paypal-buttons-${stableId}`, [stableId]);
  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "loading" | "capturing" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [amount, setAmount] = useState(() => (defaultAmountCents / 100).toFixed(0));
  const [bookRequested, setBookRequested] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const amountRef = useRef(amount);
  const bookRequestedRef = useRef(bookRequested);
  const bookTitleRef = useRef(bookTitle);

  async function startCheckout() {
    setStatus("checking");
    setError("");

    const supabase = createBrowserClient();
    if (!supabase) {
      setError("Paiement momentanement indisponible. Reessayez dans quelques instants.");
      setStatus("error");
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/auth/login?next=${next}`;
      return;
    }

    setToken(data.session.access_token);
    setOpen(true);

    const checkoutConfig = await getPayPalCheckoutConfigAction();
    if (!checkoutConfig.ok || !checkoutConfig.clientId) {
      setError(checkoutConfig.error || "Le paiement PayPal n'a pas pu etre prepare.");
      setStatus("error");
      return;
    }

    setConfig({
      clientId: checkoutConfig.clientId,
      currency: checkoutConfig.currency,
      defaultAmount: checkoutConfig.defaultAmount
    });
    setStatus("ready");
  }

  function closeModal() {
    if (status === "loading" || status === "capturing") return;
    setOpen(false);
    setStatus("idle");
    setError("");
  }

  useEffect(() => {
    if (!open || !config?.clientId) return;

    const scriptId = "paypal-js-sdk";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    const params = new URLSearchParams({
      "client-id": config.clientId,
      currency: config.currency || "EUR",
      intent: "capture",
      components: "buttons"
    });
    const src = `https://www.paypal.com/sdk/js?${params.toString()}`;

    if (existing && existing.dataset.paypalSrc !== src) {
      existing.remove();
      delete window.paypal;
    }

    if (window.paypal && document.getElementById(scriptId)) {
      setSdkReady(true);
      return;
    }

    setSdkReady(false);
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
  }, [config?.clientId, config?.currency, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !sdkReady || !token || !config?.clientId) return;
    const container = document.getElementById(paypalContainerId);
    if (!container || !window.paypal) return;

    container.innerHTML = "";
    let buttons: PayPalButtonsInstance | null = null;

    try {
      buttons = window.paypal.Buttons({
        style: {
          shape: "rect",
          layout: "vertical",
          color: "gold",
          label: "paypal"
        },
        createOrder: async () => {
          setStatus("loading");
          setError("");
          if (bookRequestedRef.current && !bookTitleRef.current.trim()) {
            setStatus("ready");
            throw new Error("Indiquez le titre du livre souhaite.");
          }
          const result = await createPayPalOrderAction({
            amount: amountRef.current,
            bookRequested: bookRequestedRef.current,
            bookTitle: bookTitleRef.current,
            courseId,
            origin: window.location.origin,
            token
          });

          if (result.alreadyEnrolled && result.redirectUrl) {
            window.location.href = result.redirectUrl;
            return "";
          }

          if (!result.ok || !result.orderId) {
            throw new Error(result.error || "PayPal n'a pas pu creer la commande.");
          }

          setStatus("ready");
          return result.orderId;
        },
        onApprove: async (data, actions) => {
          if (!data.orderID) throw new Error("PayPal n'a pas renvoye de reference de commande.");

          setStatus("capturing");
          setError("");
          const result = await capturePayPalOrderAction({ orderId: data.orderID, token });

          if (!result.ok) {
            if (result.recoverable && actions.restart) {
              await actions.restart();
              setStatus("ready");
              return;
            }
            throw new Error(result.error || "Le paiement n'a pas pu etre confirme.");
          }

          setStatus("success");
          window.location.href = result.redirectUrl || "/espace-etudiant";
        },
        onCancel: () => {
          setStatus("ready");
          setError("Paiement annule. Vous pouvez relancer PayPal quand vous voulez.");
        },
        onError: (paypalError) => {
          setError(paypalError instanceof Error ? paypalError.message : "Le paiement PayPal a echoue.");
          setStatus("error");
        }
      });
      buttons.render(`#${paypalContainerId}`);
    } catch (paypalError) {
      setError(paypalError instanceof Error ? paypalError.message : "Le bouton PayPal n'a pas pu etre affiche.");
      setStatus("error");
    }

    return () => {
      container.innerHTML = "";
      buttons?.close?.();
    };
  }, [config?.clientId, courseId, open, paypalContainerId, sdkReady, token]);

  return (
    <span className="buy-course">
      <button className={className} type="button" onClick={startCheckout} disabled={status === "checking" || status === "loading" || status === "capturing"}>
        {status === "checking" || status === "loading" || status === "capturing" ? <Loader2 className="action-spin" size={18} /> : <CreditCard size={18} />}
        {status === "checking" ? "Preparation..." : status === "capturing" ? "Validation..." : label}
      </button>
      {error && !open && <small className="field-error" role="alert">{error}</small>}
      {open && createPortal((
        <div className="modal-backdrop paypal-checkout-backdrop" role="presentation">
          <div className="modal-card paypal-checkout-modal" role="dialog" aria-modal="true" aria-labelledby={`${paypalContainerId}-title`}>
            <div className="paypal-modal-header">
              <div>
                <span className="badge"><CreditCard size={14} /> PayPal</span>
                <h2 id={`${paypalContainerId}-title`} className="font-display">Paiement libre</h2>
              </div>
              <button className="modal-close" type="button" onClick={closeModal} aria-label="Fermer le paiement">
                <X size={18} />
              </button>
            </div>
            <p className="paypal-checkout-intro">
              Le prix conseille est de 99 euros, mais vous choisissez librement le montant verse pour {courseTitle}.
              La formation est attribuee automatiquement des que PayPal confirme le paiement.
            </p>
            <label className="paypal-amount-field">
              <span>Montant libre en euros</span>
              <input
                className="input"
                inputMode="decimal"
                min="1"
                step="0.01"
                value={amount}
                onChange={event => {
                  amountRef.current = event.target.value;
                  setAmount(event.target.value);
                }}
                disabled={status === "loading" || status === "capturing"}
              />
            </label>
            <label className="paypal-book-request">
              <input
                type="checkbox"
                checked={bookRequested}
                onChange={event => {
                  bookRequestedRef.current = event.target.checked;
                  setBookRequested(event.target.checked);
                }}
                disabled={status === "loading" || status === "capturing"}
              />
              <span>
                <strong><BookOpen size={16} /> Demander le livre d'apologetique</strong>
                <small>La demande sera transmise a la direction, qui validera ensuite l'acceptation.</small>
              </span>
            </label>
            {bookRequested && (
              <label className="paypal-book-title">
                <span>Titre du livre souhaite</span>
                <input
                  className="input"
                  maxLength={180}
                  placeholder="Ex : Mere de Dieu de Brant Pitre"
                  required
                  value={bookTitle}
                  onChange={event => {
                    bookTitleRef.current = event.target.value;
                    setBookTitle(event.target.value);
                  }}
                  disabled={status === "loading" || status === "capturing"}
                />
                <small>La direction recevra ce titre avec votre demande.</small>
              </label>
            )}
            <div className="paypal-buttons-frame" id={paypalContainerId}>
              {!sdkReady && status !== "error" ? <p><Loader2 className="action-spin" size={18} /> Chargement PayPal...</p> : null}
            </div>
            {status === "capturing" && <p className="muted">Validation du paiement et attribution de la formation...</p>}
            {error && <small className="field-error" role="alert">{error}</small>}
          </div>
        </div>
      ), document.body)}
    </span>
  );
}
