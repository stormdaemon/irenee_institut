"use client";

import { BookOpen, CreditCard, Loader2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { StripeCheckoutForm } from "@/components/StripeCheckoutForm";
import { createBrowserClient } from "@/lib/supabase";

type CheckoutApiResponse = {
  alreadyActive?: boolean;
  clientSecret?: string;
  code?: string;
  error?: string;
  ok?: boolean;
  publishableKey?: string;
  redirectUrl?: string;
};

export function LibraryMembershipButton() {
  const stableId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `library-stripe-checkout-title-${stableId}`;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "loading" | "error">("idle");
  const [payment, setPayment] = useState<{ clientSecret: string; publishableKey: string } | null>(null);

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
    if (!data.session) {
      window.location.href = `/auth/login?next=${encodeURIComponent("/bibliotheque-apologetique")}`;
      return;
    }

    setOpen(true);
    setStatus("ready");
  }

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
    setError("");
    setStatus("idle");
    setPayment(null);
  }

  async function continueToStripe() {
    setStatus("loading");
    setError("");
    let response: Response;
    let result: CheckoutApiResponse;
    try {
      response = await fetch("/api/payments/library/checkout", {
        body: "{}",
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
      window.location.href = `/auth/login?next=${encodeURIComponent("/bibliotheque-apologetique")}`;
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
      <button className="btn btn-gold" type="button" onClick={startCheckout} disabled={disabled}>
        {disabled ? <Loader2 className="action-spin" size={18} /> : <BookOpen size={18} />}
        Adherer pour 15 EUR
      </button>
      {error && !open && <small className="field-error" role="alert">{error}</small>}
      {open && createPortal((
        <div className="modal-backdrop paypal-checkout-backdrop" role="presentation">
          <div className="modal-card paypal-checkout-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="paypal-modal-header">
              <div>
                <span className="badge"><CreditCard size={14} /> Stripe</span>
                <h2 id={titleId} className="font-display">Adhesion bibliotheque</h2>
              </div>
              <button className="modal-close" type="button" onClick={closeModal} aria-label="Fermer le paiement"><X size={18} /></button>
            </div>
            <p className="paypal-checkout-intro">
              L'adhesion annuelle a la bibliotheque d'ecole apologetique est fixee a 15 EUR.
              Une fois le paiement confirme, vous pourrez demander le livre de votre choix depuis votre espace etudiant.
            </p>
            <div className="paypal-membership-price"><strong>15 EUR</strong><span>Adhesion annuelle</span></div>
            {payment ? (
              <StripeCheckoutForm
                clientSecret={payment.clientSecret}
                publishableKey={payment.publishableKey}
                submitLabel="Payer 15 €"
              />
            ) : (
              <>
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
