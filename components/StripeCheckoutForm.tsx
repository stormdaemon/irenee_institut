"use client";

import { Loader2, Lock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isStripeCheckoutClientSecret } from "@/lib/stripe-checkout-url";

type StripeMountable = {
  destroy: () => void;
  mount: (target: HTMLElement) => void;
};

type StripeCheckoutSession = {
  confirm: () => Promise<{ error?: { message?: string }; type?: string }>;
  createPaymentElement: (options?: Record<string, unknown>) => StripeMountable;
};

type StripeCheckoutInitializer = (options: Record<string, unknown>) => Promise<StripeCheckoutSession>;

// Stripe expose la même API sous deux noms selon la version du SDK servie.
type StripeGlobal = (publishableKey: string) => {
  initCheckout?: StripeCheckoutInitializer;
  initCheckoutElementsSdk?: StripeCheckoutInitializer;
};

declare global {
  interface Window {
    Stripe?: StripeGlobal;
  }
}

const STRIPE_JS_URL = "https://js.stripe.com/v3/";

// Stripe.js doit provenir de chez Stripe : c'est ce qui garantit que les
// numéros de carte ne transitent jamais par nos serveurs.
function loadStripeJs() {
  if (typeof window === "undefined") return Promise.reject(new Error("indisponible"));
  if (window.Stripe) return Promise.resolve(window.Stripe);

  return new Promise<StripeGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${STRIPE_JS_URL}"]`);
    const onLoad = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error("indisponible")));
    if (existing) {
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", () => reject(new Error("indisponible")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = STRIPE_JS_URL;
    script.async = true;
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("indisponible")), { once: true });
    document.head.appendChild(script);
  });
}

// Les champs carte reprennent la palette du site : le formulaire reste celui de
// l'Institut, Stripe ne fournit que la saisie sécurisée.
const appearance = {
  theme: "stripe",
  variables: {
    colorDanger: "#9d1f16",
    colorPrimary: "#071d49",
    colorText: "#172033",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSizeBase: "15px",
    spacingUnit: "4px"
  }
};

export function StripeCheckoutForm({
  clientSecret,
  publishableKey,
  submitLabel = "Payer maintenant"
}: {
  clientSecret: string;
  publishableKey: string;
  submitLabel?: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const checkoutRef = useRef<StripeCheckoutSession | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "paying" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let element: StripeMountable | null = null;

    async function mountPaymentFields() {
      if (!isStripeCheckoutClientSecret(clientSecret) || !/^pk_(?:live|test)_[A-Za-z0-9]+$/.test(publishableKey)) {
        if (!cancelled) {
          setError("Le paiement est momentanément indisponible. Réessayez dans quelques instants.");
          setStatus("error");
        }
        return;
      }
      try {
        const stripeFactory = await loadStripeJs();
        if (cancelled) return;
        const stripe = stripeFactory(publishableKey);
        const initCheckout = typeof stripe.initCheckout === "function"
          ? stripe.initCheckout.bind(stripe)
          : typeof stripe.initCheckoutElementsSdk === "function"
            ? stripe.initCheckoutElementsSdk.bind(stripe)
            : null;
        if (!initCheckout) throw new Error("indisponible");
        const checkout = await initCheckout({
          clientSecret,
          elementsOptions: { appearance }
        });
        if (cancelled) return;
        checkoutRef.current = checkout;
        element = checkout.createPaymentElement();
        if (mountRef.current) element.mount(mountRef.current);
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setError("Le formulaire de paiement n'a pas pu être chargé. Réessayez dans quelques instants.");
        setStatus("error");
      }
    }

    void mountPaymentFields();
    return () => {
      cancelled = true;
      try {
        element?.destroy();
      } catch {
        // Le démontage échoue si Stripe a déjà nettoyé l'élément.
      }
      checkoutRef.current = null;
    };
  }, [clientSecret, publishableKey]);

  const pay = useCallback(async () => {
    const checkout = checkoutRef.current;
    if (!checkout || status === "paying") return;
    setStatus("paying");
    setError("");
    try {
      // Stripe redirige lui-même vers la page de confirmation quand le
      // paiement aboutit ; on ne traite ici que les refus.
      const result = await checkout.confirm();
      if (result?.type === "error" || result?.error) {
        setError(result.error?.message || "Le paiement n'a pas abouti. Aucun montant n'a été débité.");
        setStatus("ready");
      }
    } catch {
      setError("Le paiement n'a pas pu être confirmé. Aucun montant n'a été débité.");
      setStatus("ready");
    }
  }, [status]);

  return (
    <div className="stripe-checkout-form">
      <div ref={mountRef} className="stripe-checkout-fields" aria-busy={status === "loading"} />
      {status === "loading" && (
        <p className="muted stripe-checkout-loading">
          <Loader2 className="action-spin" size={16} aria-hidden="true" /> Préparation du paiement sécurisé...
        </p>
      )}
      {status !== "error" && (
        <button
          className="btn btn-primary stripe-checkout-submit"
          type="button"
          onClick={pay}
          disabled={status !== "ready"}
        >
          {status === "paying" ? <Loader2 className="action-spin" size={18} aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
          {status === "paying" ? "Paiement en cours..." : submitLabel}
        </button>
      )}
      {error && <small className="field-error" role="alert">{error}</small>}
      <p className="stripe-checkout-trust">
        <Lock size={13} aria-hidden="true" />
        <span>Paiement sécurisé — vos données bancaires ne transitent pas par l’Institut.</span>
      </p>
      <p className="stripe-checkout-powered">Powered by Stripe</p>
    </div>
  );
}
