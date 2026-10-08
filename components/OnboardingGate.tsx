"use client";

import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, HandHeart, Loader2, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/browser-auth";

const donationUrl = "/formations";

type Slide = {
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  imagePosition: string;
  proof?: string;
  highlights: string[];
};

const slides: Slide[] = [
  {eyebrow:"Bienvenue chez Apostolos",title:"Une question. Un chemin d’étude.",body:"Bienvenue à l’Institut Apostolos Saint Irénée. Prenez le temps d’étudier les sources, d’interroger les idées et de construire une parole éclairée par la foi.",image:"/images/apostolos/cloitre.png",imagePosition:"50% 50%",proof:"La rigueur de l’étude, la liberté d’avancer.",highlights:["Comprendre","Approfondir","Transmettre"]},
  {eyebrow:"Votre méthode",title:"Un module à la fois.",body:"Ouvrez un cours accessible depuis votre espace. Lisez chaque module, retrouvez son plan et validez votre progression pour reprendre au bon endroit lors de votre prochaine visite.",image:"/images/apostolos/etude.png",imagePosition:"50% 50%",proof:"Un parcours lisible, à votre rythme.",highlights:["Lire","Prendre le temps","Progresser"]},
  {eyebrow:"Votre espace",title:"Place à l’étude.",body:"Vos cours et leur progression se retrouvent dans votre espace étudiant. Vous pourrez aussi y consulter les devoirs, documents et séances disponibles pour votre parcours.",image:"/images/apostolos/cloitre.png",imagePosition:"60% 50%",proof:"Bienvenue à l’Institut Apostolos Saint Irénée.",highlights:["Cours & modules","Progression","Ressources"]}
];

type GateStatus = "checking" | "hidden" | "visible";
type OnboardingStatusPayload = {
  ok?: boolean;
  needsOnboarding?: boolean;
};

const sessionTimeoutMs = 4500;
const onboardingStatusTimeoutMs = 8000;

function WordReveal({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((word, index) => (
        <span
          className="onboarding-word"
          key={`${word}-${index}`}
          style={{ "--word-index": index } as CSSProperties}
        >
          {word}
          {index < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

function shouldForcePreview() {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") return false;
  return new URLSearchParams(window.location.search).get("onboarding") === "preview";
}

function isPassiveOnboardingPath(pathname: string | null) {
  return Boolean(
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/paiement") ||
    pathname?.startsWith("/paypal_checkout_valid") ||
    pathname?.startsWith("/stripe_webhook")
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  return new Promise<T>(resolve => {
    const timer = window.setTimeout(() => resolve(fallback), timeoutMs);
    promise.then(
      value => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

async function fetchOnboardingStatus() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), onboardingStatusTimeoutMs);

  try {
    const response = await fetch("/api/onboarding/status", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null) as OnboardingStatusPayload | null;
    return { response, payload };
  } catch {
    return { response: null, payload: null };
  } finally {
    window.clearTimeout(timer);
  }
}

export function OnboardingGate() {
  const [status, setStatus] = useState<GateStatus>("hidden");
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<"next" | "back">("next");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const preview = useMemo(shouldForcePreview, []);
  const slide = slides[active];
  const isLast = active === slides.length - 1;

  useEffect(() => {
    let mounted = true;
    const context = createBrowserClient();

    async function load() {
      if (preview) {
        if (!mounted) return;
        setStatus("visible");
        return;
      }

      if (!context || isPassiveOnboardingPath(pathname)) {
        if (mounted) setStatus("hidden");
        return;
      }

      const { data } = await withTimeout<{ data: { session: object | null } }>(
        context.auth.getSession().catch(() => ({ data: { session: null } })),
        sessionTimeoutMs,
        { data: { session: null } }
      );
      if (!data.session) {
        if (mounted) setStatus("hidden");
        return;
      }

      if (mounted) setStatus("checking");

      const { response, payload } = await fetchOnboardingStatus();

      if (!mounted) return;

      if (!response?.ok || payload?.ok !== true || payload.needsOnboarding !== true) {
        setStatus("hidden");
        return;
      }

      setStatus("visible");
    }

    load();
    if (!context || preview) {
      return () => {
        mounted = false;
      };
    }

    const { data: listener } = context.auth.onAuthStateChange((_event: string, session: object | null) => {
      if (isPassiveOnboardingPath(pathname)) {
        setStatus("hidden");
        return;
      }
      if (!session) {
        setStatus("hidden");
        return;
      }
      window.setTimeout(load, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, preview]);

  useEffect(() => {
    if (status !== "visible") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "visible") return;

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        goNext();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  function goBack() {
    if (active === 0 || saving) return;
    setError("");
    setDirection("back");
    setActive(current => Math.max(0, current - 1));
  }

  async function finish() {
    if (preview) {
      setStatus("hidden");
      return;
    }

    setSaving(true);
    setError("");

    const context = createBrowserClient();
    const { data } = await context?.auth.getSession().catch(() => ({ data: { session: null } })) || { data: { session: null } };
    if (!data.session) {
      setSaving(false);
      setError("Reconnectez-vous pour finaliser votre accueil.");
      return;
    }

    const response = await fetch("/api/onboarding/complete", {
      method: "POST",
      credentials: "same-origin"
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setSaving(false);
    if (!response?.ok || payload?.ok !== true) {
      setError(payload?.error || "La validation n'a pas pu être enregistrée. Réessayez dans un instant.");
      return;
    }

    setStatus("hidden");
  }

  function goNext() {
    if (saving) return;
    if (isLast) {
      finish();
      return;
    }
    setError("");
    setDirection("next");
    setActive(current => Math.min(slides.length - 1, current + 1));
  }

  // A background welcome lookup must not cover controls between pointer down and up.
  if (status !== "visible") return null;

  return (
    <section
      className={`onboarding-veil onboarding-direction-${direction}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{
        "--onboarding-image": `url(${slide.image})`,
        "--onboarding-image-position": slide.imagePosition,
        "--onboarding-progress": `${((active + 1) / slides.length) * 100}%`
      } as CSSProperties}
    >
      <div className="onboarding-bg" aria-hidden="true" />
      <div className="onboarding-shade" aria-hidden="true" />

      <div className="onboarding-shell" key={active}>
        <div className="onboarding-progress" aria-label={`Étape ${active + 1} sur ${slides.length}`}>
          <span>{String(active + 1).padStart(2, "0")}</span>
          <div><i /></div>
          <span>{String(slides.length).padStart(2, "0")}</span>
        </div>

        <div className="onboarding-copy">
          <p className="onboarding-eyebrow"><Sparkles size={16} aria-hidden="true" /> {slide.eyebrow}</p>
          <h1 id="onboarding-title" className="font-display">
            <WordReveal text={slide.title} />
          </h1>
          <p className="onboarding-body">{slide.body}</p>
          {slide.proof && <p className="onboarding-proof">{slide.proof}</p>}
          <div className="onboarding-highlights" aria-label="Repères de cette étape">
            {slide.highlights.map(item => (
              <span key={item}><CheckCircle2 size={16} aria-hidden="true" /> {item}</span>
            ))}
          </div>
        </div>

        <aside className="onboarding-map" aria-label="Parcours d'accueil">
          {slides.map((item, index) => (
            <button
              aria-current={index === active ? "step" : undefined}
              className={index <= active ? "visited" : ""}
              disabled={index > active || saving}
              key={item.eyebrow}
              onClick={() => {
                if (index > active) return;
                setDirection(index < active ? "back" : "next");
                setActive(index);
              }}
              type="button"
            >
              <span>{index + 1}</span>
              <strong>{item.eyebrow}</strong>
            </button>
          ))}
        </aside>

        <div className="onboarding-actions">
          {active > 0 && (
            <button className="btn onboarding-back" type="button" onClick={goBack} disabled={saving}>
              <ArrowLeft size={18} aria-hidden="true" /> Retour
            </button>
          )}
          {active === 8 && (
            <a className="btn onboarding-donate" href={donationUrl} target="_blank" rel="noreferrer">
              <HandHeart size={18} aria-hidden="true" /> Faire un don
            </a>
          )}
          <button className="btn onboarding-next" type="button" onClick={goNext} disabled={saving}>
            {saving ? <Loader2 className="action-spin" size={18} aria-hidden="true" /> : isLast ? <BookOpen size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
            {saving ? "Ouverture..." : isLast ? "Entrer dans mon espace étudiant" : active === 0 ? "Commencer la visite" : "Continuer"}
          </button>
        </div>

        {error && <p className="onboarding-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
