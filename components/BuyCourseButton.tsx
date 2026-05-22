"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";

type BuyCourseButtonProps = {
  courseId: string;
  label?: string;
  className?: string;
};

export function BuyCourseButton({ courseId, label = "Acheter la formation", className = "btn btn-primary" }: BuyCourseButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function startCheckout() {
    setStatus("loading");
    setError("");

    const supabase = createBrowserClient();
    if (!supabase) {
      setError("Paiement momentanément indisponible. Réessayez dans quelques instants.");
      setStatus("error");
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/auth/login?next=${next}`;
      return;
    }

    const response = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({ courseId })
    });
    const result = await response.json().catch(() => null);

    if (response.ok && result?.alreadyEnrolled && result?.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }

    if (!response.ok || !result?.url) {
      setError(result?.error || "Le paiement n'a pas pu être préparé.");
      setStatus("error");
      return;
    }

    window.location.href = result.url;
  }

  return (
    <span className="buy-course">
      <button className={className} type="button" onClick={startCheckout} disabled={status === "loading"}>
        {status === "loading" ? <Loader2 className="action-spin" size={18} /> : <CreditCard size={18} />}
        {status === "loading" ? "Préparation du paiement..." : label}
      </button>
      {error && <small className="field-error" role="alert">{error}</small>}
    </span>
  );
}
