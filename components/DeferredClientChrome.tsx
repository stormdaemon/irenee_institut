"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const FloatingNetworkMenu = dynamic(
  () => import("@/components/FloatingNetworkMenu").then(mod => mod.FloatingNetworkMenu),
  { ssr: false }
);
const DonationPrompt = dynamic(
  () => import("@/components/DonationPrompt").then(mod => mod.DonationPrompt),
  { ssr: false }
);
const OnboardingGate = dynamic(
  () => import("@/components/OnboardingGate").then(mod => mod.OnboardingGate),
  { ssr: false }
);

const publicChromeDelayMs = 7000;

function isPublicMarketingPath(pathname: string | null) {
  return Boolean(
    pathname === "/" ||
    pathname === "/a-propos" ||
    pathname === "/contact" ||
    pathname === "/equipe" ||
    pathname === "/institut-apologetique" ||
    pathname === "/ecole-apologetique-en-ligne" ||
    pathname === "/programme-apologetique" ||
    pathname === "/ressources-apologetique" ||
    pathname === "/bibliotheque-apologetique" ||
    pathname === "/formations" ||
    pathname?.startsWith("/blog") ||
    pathname?.startsWith("/presse")
  );
}

export function DeferredClientChrome() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isPublicMarketingPath(pathname)) {
      setReady(true);
      return;
    }

    setReady(false);
    let active = true;
    const activate = () => {
      if (!active) return;
      setReady(true);
    };
    const timer = window.setTimeout(activate, publicChromeDelayMs);

    window.addEventListener("pointerdown", activate, { once: true });
    window.addEventListener("keydown", activate, { once: true });

    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", activate);
      window.removeEventListener("keydown", activate);
    };
  }, [pathname]);

  if (!ready) return null;

  return (
    <>
      <FloatingNetworkMenu />
      <DonationPrompt />
      <OnboardingGate />
    </>
  );
}
