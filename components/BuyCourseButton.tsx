"use client";

import { BookOpen, CreditCard, Loader2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createStripeCheckoutSessionAction, getStripeCheckoutConfigAction } from "@/app/actions/payments";
import { cleanAnnualPassSignupPath } from "@/lib/routes";
import { createBrowserClient } from "@/lib/supabase";

type BuyCourseButtonProps = {
  defaultAmountCents?: number;
  label?: string;
  className?: string;
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
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState(() => (defaultAmountCents / 100).toFixed(0));
  const [bookRequested, setBookRequested] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
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
    if (!data.session?.access_token) {
      window.location.href = cleanAnnualPassSignupPath;
      return;
    }

    const checkoutConfig = await getStripeCheckoutConfigAction();
    if (!checkoutConfig.ok) {
      setError(checkoutConfig.error || "Le paiement Stripe n'a pas pu etre prepare.");
      setStatus("error");
      return;
    }

    setToken(data.session.access_token);
    setOpen(true);
    setStatus("ready");
  }

  useEffect(() => {
    if (typeof window === "undefined" || autoStartedRef.current) return;
    if (checkoutParam !== "annual-pass") return;

    autoStartedRef.current = true;
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.delete("checkout");
    const nextQuery = nextParams.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
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
  }

  async function continueToStripe() {
    if (bookRequested && !bookTitle.trim()) {
      setError("Indiquez le titre du livre souhaite.");
      return;
    }

    setStatus("loading");
    setError("");
    const result = await createStripeCheckoutSessionAction({
      amount,
      bookRequested,
      bookTitle,
      origin: window.location.origin,
      token
    });

    if (result.alreadyActive && result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }

    if (!result.ok || !result.checkoutUrl) {
      setError(result.error || "Stripe n'a pas pu preparer le paiement.");
      setStatus("error");
      return;
    }

    window.location.href = result.checkoutUrl;
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
              Continuer vers Stripe
            </button>
            {status === "loading" && <p className="muted">Redirection vers le paiement securise...</p>}
            {error && <small className="field-error" role="alert">{error}</small>}
          </div>
        </div>
      ), document.body)}
    </span>
  );
}
