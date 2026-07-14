"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type PaymentState = "checking" | "active" | "processing" | "unpaid" | "expired" | "unknown";
type ProductType = "annual_pass" | "library_membership" | "legacy_course";

type ReconciliationPayload = {
  ok?: boolean;
  product?: ProductType;
  status?: Exclude<PaymentState, "checking">;
};

const terminalStates = new Set<PaymentState>(["active", "unpaid", "expired", "unknown"]);

function copyFor(state: PaymentState, product?: ProductType) {
  const isLibrary = product === "library_membership";

  if (state === "active") {
    return {
      description: isLibrary
        ? "Votre paiement est confirmé et votre adhésion à la bibliothèque est active. Vous pouvez demander votre livre depuis votre espace étudiant."
        : product === "legacy_course"
          ? "Votre paiement est confirmé et votre formation est maintenant accessible depuis votre espace étudiant."
          : "Votre paiement est confirmé et votre pass annuel est actif. L’ensemble du cursus est maintenant accessible depuis votre espace étudiant.",
      title: "Paiement confirmé"
    };
  }
  if (state === "processing") {
    return {
      description: "Stripe traite encore la confirmation. Cette page vérifie automatiquement votre accès ; ne relancez pas un second paiement.",
      title: "Activation en cours"
    };
  }
  if (state === "unpaid") {
    return {
      description: "Stripe n’a pas confirmé ce paiement. Aucun accès n’a été activé pour cette session.",
      title: "Paiement non confirmé"
    };
  }
  if (state === "expired") {
    return {
      description: "Cette session de paiement a expiré avant sa confirmation. Aucun accès n’a été activé pour cette session.",
      title: "Session expirée"
    };
  }
  if (state === "unknown") {
    return {
      description: "Nous ne pouvons pas confirmer cette session avec le compte connecté. Vérifiez que vous utilisez le compte ayant lancé le paiement, puis réessayez.",
      title: "Confirmation impossible"
    };
  }
  return {
    description: "Nous vérifions directement auprès de Stripe puis contrôlons que votre accès est bien actif.",
    title: "Vérification du paiement"
  };
}

function StatusIcon({ state }: { state: PaymentState }) {
  if (state === "active") return <CheckCircle2 size={48} color="#22c55e" aria-hidden="true" />;
  if (state === "unpaid") return <XCircle size={48} color="#ef4444" aria-hidden="true" />;
  if (state === "expired" || state === "unknown") {
    return <AlertTriangle size={48} color="#eab308" aria-hidden="true" />;
  }
  if (state === "processing") return <Clock3 size={48} color="#eab308" aria-hidden="true" />;
  return <Loader2 className="action-spin" size={48} aria-hidden="true" />;
}

export default function PaymentConfirmation({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<PaymentState>("checking");
  const [product, setProduct] = useState<ProductType | undefined>();
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setState("unknown");
      return;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function reconcile(attempt: number) {
      try {
        const response = await fetch("/api/payments/stripe/reconcile", {
          body: JSON.stringify({ sessionId }),
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal
        });
        const payload = await response.json().catch(() => null) as ReconciliationPayload | null;
        if (stopped) return;

        const nextState = payload?.status;
        if (payload?.product) setProduct(payload.product);

        if (nextState && ["active", "processing", "unpaid", "expired", "unknown"].includes(nextState)) {
          setState(nextState);
          if (!terminalStates.has(nextState) && attempt < 9) {
            timer = setTimeout(() => reconcile(attempt + 1), attempt < 2 ? 1_000 : 2_000);
          }
          return;
        }

        if (attempt < 4) {
          setState(attempt === 0 ? "checking" : "processing");
          timer = setTimeout(() => reconcile(attempt + 1), 2_000);
        } else {
          setState("unknown");
        }
      } catch (error) {
        if (stopped || (error instanceof Error && error.name === "AbortError")) return;
        if (attempt < 4) {
          setState(attempt === 0 ? "checking" : "processing");
          timer = setTimeout(() => reconcile(attempt + 1), 2_000);
        } else {
          setState("unknown");
        }
      }
    }

    setState("checking");
    void reconcile(0);

    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [retryKey, sessionId]);

  const copy = copyFor(state, product);
  const purchasePath = product === "library_membership" ? "/bibliotheque-apologetique" : "/formations";

  return (
    <section className="section" style={{ minHeight: 620 }}>
      <div className="container center">
        <div
          aria-busy={state === "checking" || state === "processing"}
          aria-live="polite"
          className="card"
          style={{ padding: 42, maxWidth: 740, margin: "0 auto" }}
        >
          <StatusIcon state={state} />
          <h1 className="title" style={{ marginTop: 18 }}>{copy.title}</h1>
          <p className="subtitle">{copy.description}</p>
          <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {state === "active" && (
              <Link className="btn btn-primary" href="/espace-etudiant">Ouvrir mon espace étudiant</Link>
            )}
            {(state === "processing" || state === "unknown") && (
              <button className="btn btn-primary" onClick={() => setRetryKey(value => value + 1)} type="button">
                Vérifier à nouveau
              </button>
            )}
            {state !== "checking" && (
              <Link className="btn btn-outline" href={purchasePath}>
                {product === "library_membership" ? "Voir la bibliothèque" : "Voir les formations"}
              </Link>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
