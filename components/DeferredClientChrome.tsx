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
    pathname === "/choisir-formation-apologetique" ||
    pathname === "/ressources-apologetique" ||
    pathname === "/bibliotheque-apologetique" ||
    pathname === "/formations" ||
    pathname?.startsWith("/blog") ||
    pathname?.startsWith("/presse")
  );
}

function isPrivateWorkspacePath(pathname: string | null) {
  return Boolean(
    pathname?.startsWith("/cours") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/espace-etudiant") ||
    pathname?.startsWith("/devoirs") ||
    pathname?.startsWith("/examen-final") ||
    pathname?.startsWith("/parametres") ||
    pathname?.startsWith("/direct")
  );
}

export function DeferredClientChrome() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const privateWorkspace = isPrivateWorkspacePath(pathname);

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
      {!privateWorkspace && <FloatingNetworkMenu />}
      {!privateWorkspace && <DonationPrompt />}
      <OnboardingGate />
    </>
  );
}
