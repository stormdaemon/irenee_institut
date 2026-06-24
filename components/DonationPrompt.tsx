"use client";

import { HandHeart, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const donationUrl = "https://www.paypal.com/ncp/payment/4TJJK3C697B9A";
const storageKey = "irenee-donation-prompt-dismissed";
const promptDelay = 45000;

function isConversionPath(pathname: string | null) {
  return Boolean(
    pathname === "/" ||
    pathname?.startsWith("/formations") ||
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/paiement") ||
    pathname?.startsWith("/cgv")
  );
}

export function DonationPrompt() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isConversionPath(pathname)) return;

    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {
      // Storage can be unavailable in hardened browsing modes.
    }

    const timer = window.setTimeout(() => setVisible(true), promptDelay);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(storageKey, "true");
    } catch {
      // Ignore storage failures; the popup still closes for this render.
    }
  };

  if (!visible) return null;

  return (
    <div className="donation-popup-backdrop" role="presentation" onClick={dismiss}>
      <aside
        className="donation-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-popup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="donation-popup-close" type="button" aria-label="Fermer" onClick={dismiss}>
          <X size={18} aria-hidden="true" />
        </button>
        <div className="donation-popup-icon">
          <HandHeart size={30} aria-hidden="true" />
        </div>
        <p className="donation-popup-kicker">Soutenir l'Institut Saint Irénée</p>
        <h2 id="donation-popup-title" className="font-display">Aidez-nous à former les apologètes de demain</h2>
        <p>
          Votre don permet de rendre les formations plus accessibles et de faire grandir cette oeuvre de transmission au service de la foi.
        </p>
        <div className="donation-popup-actions">
          <a className="btn btn-gold" href={donationUrl} target="_blank" rel="noreferrer" onClick={dismiss}>
            Faire un don
          </a>
          <button className="btn btn-outline donation-popup-later" type="button" onClick={dismiss}>
            Plus tard
          </button>
        </div>
      </aside>
    </div>
  );
}
