"use client";

import { BookOpen, CreditCard, Loader2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cleanAnnualPassSignupPath } from "@/lib/routes";
import { StripeCheckoutForm } from "@/components/StripeCheckoutForm";
import { createBrowserClient } from "@/lib/supabase";

type BuyCourseButtonProps = {
  defaultAmountCents?: number;
  label?: string;
  className?: string;
};

type CheckoutApiResponse = {
  alreadyActive?: boolean;
  clientSecret?: string;
  code?: string;
  error?: string;
  ok?: boolean;
  publishableKey?: string;
  redirectUrl?: string;
};

export function BuyCourseButton({
  defaultAmountCents = 9900,
  label = "Obtenir le pass annuel",
  className = "btn btn-primary"
}: BuyCourseButtonProps) {
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get("checkout");
  const stableId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `stripe-checkout-title-${stableId}`;
  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => (defaultAmountCents / 100).toFixed(0));
  const [bookRequested, setBookRequested] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [payment, setPayment] = useState<{ clientSecret: string; publishableKey: string } | null>(null);
  const autoStartedRef = useRef(false);

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
    if (!data.session) {
      window.location.href = cleanAnnualPassSignupPath;
      return;
    }

    setOpen(true);
    setStatus("ready");
    if (checkoutParam === "annual-pass") {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete("checkout");
      const nextQuery = nextParams.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || autoStartedRef.current) return;
    if (checkoutParam !== "annual-pass") return;

    autoStartedRef.current = true;
    startCheckout();
  }, [checkoutParam]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeModal() {
    if (status === "loading") return;
    setOpen(false);
    setStatus("idle");
    setError("");
    setPayment(null);
  }

  async function continueToStripe() {
    if (bookRequested && !bookTitle.trim()) {
      setError("Indiquez le titre du livre souhaite.");
      return;
    }

    setStatus("loading");
    setError("");
    let response: Response;
    let result: CheckoutApiResponse;
    try {
      response = await fetch("/api/payments/checkout", {
        body: JSON.stringify({ amount, bookRequested, bookTitle }),
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      result = await response.json() as CheckoutApiResponse;
    } catch {
      setError("Le service de paiement ne répond pas. Réessayez dans quelques instants.");
      setStatus("error");
      return;
    }

    if (response.status === 401 || result.code === "AUTH_REQUIRED") {
      window.location.href = cleanAnnualPassSignupPath;
      return;
    }

    if (result.alreadyActive && result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }

    if (!response.ok || !result.ok || !result.clientSecret || !result.publishableKey) {
      setError(result.error || "Le paiement n'a pas pu être préparé.");
      setStatus("error");
      return;
    }

    setPayment({ clientSecret: result.clientSecret, publishableKey: result.publishableKey });
    setStatus("ready");
  }

  const disabled = status === "checking" || status === "loading";

  return (
    <span className="buy-course">
      <button className={className} type="button" onClick={startCheckout} disabled={disabled}>
        {disabled ? <Loader2 className="action-spin" size={18} /> : <CreditCard size={18} />}
        {status === "checking" ? "Preparation..." : status === "loading" ? "Redirection..." : label}
      </button>
      {error && !open && <small className="field-error" role="alert">{error}</small>}
      {open && createPortal((
        <div className="modal-backdrop paypal-checkout-backdrop" role="presentation">
          <div className="modal-card paypal-checkout-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="paypal-modal-header">
              <div>
                <span className="badge"><CreditCard size={14} /> Stripe</span>
                <h2 id={titleId} className="font-display">Pass annuel</h2>
              </div>
              <button className="modal-close" type="button" onClick={closeModal} aria-label="Fermer le paiement">
                <X size={18} />
              </button>
            </div>
            {payment ? (
              <>
                <p className="paypal-checkout-intro">
                  Montant : <strong>{amount} €</strong>{bookRequested ? " · livre demandé" : ""}. Réglez votre pass annuel
                  directement ici ; votre accès est activé dès la confirmation du paiement.
                </p>
                <StripeCheckoutForm
                  clientSecret={payment.clientSecret}
                  publishableKey={payment.publishableKey}
                  submitLabel={`Payer ${amount} €`}
                />
              </>
            ) : (
            <>
            <p className="paypal-checkout-intro">
              Le prix conseille est de 99 euros, mais vous choisissez librement le montant verse pour votre annee scolaire.
              Le pass annuel donne acces a l'ensemble du cursus des que Stripe confirme le paiement.
            </p>
            <label className="paypal-amount-field">
              <span>Montant libre en euros</span>
              <input
                className="input"
                inputMode="decimal"
                min="1"
                step="0.01"
                value={amount}
                onChange={event => setAmount(event.target.value)}
                disabled={status === "loading"}
              />
            </label>
            <label className="paypal-book-request">
              <input
                type="checkbox"
                checked={bookRequested}
                onChange={event => setBookRequested(event.target.checked)}
                disabled={status === "loading"}
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
                  onChange={event => setBookTitle(event.target.value)}
                  disabled={status === "loading"}
                />
                <small>La direction recevra ce titre avec votre demande.</small>
              </label>
            )}
            <button className="btn btn-primary" type="button" onClick={continueToStripe} disabled={status === "loading"}>
              {status === "loading" ? <Loader2 className="action-spin" size={18} /> : <CreditCard size={18} />}
              Continuer vers le paiement
            </button>
            {status === "loading" && <p className="muted">Preparation du paiement securise...</p>}
            </>
            )}
            {error && <small className="field-error" role="alert">{error}</small>}
          </div>
        </div>
      ), document.body)}
    </span>
  );
}
