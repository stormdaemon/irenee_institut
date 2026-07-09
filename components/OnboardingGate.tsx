"use client";

import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, HandHeart, Loader2, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";

const donationUrl = "https://www.paypal.com/ncp/payment/4TJJK3C697B9A";

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
  {
    eyebrow: "Bienvenue",
    title: "Merci pour votre inscription",
    body:
      "Bienvenue à l'Institut d'Apologétique Saint-Irénée. Vous rejoignez une école fondée pour former des chrétiens capables de comprendre, défendre et transmettre la foi catholique avec intelligence, précision et charité.",
    image: "/images/irenee-hero-cathedral.webp",
    imagePosition: "58% 50%",
    proof: "Votre parcours commence ici.",
    highlights: ["Comprendre", "Défendre", "Transmettre"]
  },
  {
    eyebrow: "Origine",
    title: "Une histoire qui continue",
    body:
      "L'EIDM, fondé par Samuel Armanios, a ouvert un chemin de formation et de transmission. L'Institut Saint-Irénée prolonge cet élan avec une structure pensée pour accompagner les étudiants dans la durée.",
    image: "/images/eidm-institut-saint-irenee.webp",
    imagePosition: "50% 42%",
    proof: "Même mission : rendre compte de l'espérance chrétienne.",
    highlights: ["EIDM", "Samuel Armanios", "Institut Saint-Irénée"]
  },
  {
    eyebrow: "Mission",
    title: "Comprendre, répondre, transmettre",
    body:
      "L'Institut vous aide à étudier les sources, comprendre les objections, construire une réponse juste et transmettre la foi sans renoncer à la vérité ni à la charité.",
    image: "/images/irenee-feature-strip.png",
    imagePosition: "54% 50%",
    proof: "La parole juste naît de la vérité et de la patience.",
    highlights: ["Sources", "Rigueur", "Charité"]
  },
  {
    eyebrow: "Cours",
    title: "Un parcours module après module",
    body:
      "Les formations sont organisées en cours progressifs. Chaque cours est divisé en modules pour avancer avec ordre, valider vos étapes et reprendre facilement là où vous vous êtes arrêté.",
    image: "/images/irenee-feature-4.png",
    imagePosition: "50% 48%",
    proof: "Votre progression reste visible à chaque étape.",
    highlights: ["Cours", "Modules", "Validations"]
  },
  {
    eyebrow: "Direct",
    title: "Une année accompagnée en direct",
    body:
      "À partir de septembre 2026, des sessions en direct rythment l'année. Elles permettent de retrouver les intervenants, poser vos questions, approfondir les thèmes du programme et avancer avec les autres étudiants.",
    image: "/images/irenee-feature-3.webp",
    imagePosition: "52% 50%",
    proof: "Vous n'avancez pas seul.",
    highlights: ["Dès septembre 2026", "Questions", "Promotion"]
  },
  {
    eyebrow: "Abbaye",
    title: "Étudier les Pères de l'Église en abbaye",
    body:
      "L'Institut propose aussi des sessions patristiques en abbaye : plusieurs jours pour étudier les Pères de l'Église, les conciles et les grands textes chrétiens dans un cadre propice au silence, au travail et à l'approfondissement.",
    image: "/images/cloitre-sessions-patristiques.webp",
    imagePosition: "54% 50%",
    proof: "Un temps à part pour revenir aux sources.",
    highlights: ["Abbaye", "Pères de l'Église", "Conciles"]
  },
  {
    eyebrow: "Bibliothèque",
    title: "Une bibliothèque pour nourrir votre formation",
    body:
      "La bibliothèque d'école apologétique vous permet de demander le livre apologétique de votre choix. Après l'adhésion annuelle, votre demande est transmise à la direction pour validation et organisation de la mise à disposition.",
    image: "/images/irenee-feature-1.webp",
    imagePosition: "50% 50%",
    proof: "Lire fait partie du chemin.",
    highlights: ["Adhésion annuelle", "Livre au choix", "Suivi de demande"]
  },
  {
    eyebrow: "Validations",
    title: "Vos progrès laissent une trace",
    body:
      "Au fil du cursus, vos validations peuvent donner lieu à des parchemins de connaissance. À l'achèvement du parcours et après réussite de l'évaluation finale, vous pouvez obtenir un certificat nominatif attestant votre progression.",
    image: "/images/irenee-parchment-quote-clean.webp",
    imagePosition: "58% 50%",
    proof: "Chaque validation rend visible le chemin parcouru.",
    highlights: ["Parchemins", "Évaluation finale", "Certificat nominatif"]
  },
  {
    eyebrow: "Solidarité",
    title: "Votre soutien peut ouvrir une porte",
    body:
      "Les dons permettent à l'Institut de financer la formation d'étudiants qui ne peuvent pas régler tout ou partie de leur cursus. Chaque contribution aide à rendre cette formation plus accessible à ceux qui désirent se former sérieusement, mais disposent de moyens limités.",
    image: "/images/irenee-feature-2.png",
    imagePosition: "50% 50%",
    proof: "Former un étudiant, c'est soutenir une parole chrétienne plus claire, plus solide et plus charitable.",
    highlights: ["Accessibilité", "Étudiants aidés", "Transmission"]
  },
  {
    eyebrow: "Espace étudiant",
    title: "Votre espace est prêt",
    body:
      "Vous y retrouverez vos cours, vos modules, votre progression, vos sessions en direct, vos demandes de bibliothèque, vos devoirs, vos parchemins et vos certificats.",
    image: "/images/eidm-institut-saint-irenee.webp",
    imagePosition: "50% 46%",
    proof: "Bienvenue à l'Institut Saint-Irénée. Que cette formation vous aide à servir la vérité avec intelligence et charité.",
    highlights: ["Cours", "Lives", "Documents"]
  }
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
    const supabase = createBrowserClient();

    async function load() {
      if (preview) {
        if (!mounted) return;
        setStatus("visible");
        return;
      }

      if (!supabase || isPassiveOnboardingPath(pathname)) {
        if (mounted) setStatus("hidden");
        return;
      }

      const { data } = await withTimeout<{ data: { session: object | null } }>(
        supabase.auth.getSession().catch(() => ({ data: { session: null } })),
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
    if (!supabase || preview) {
      return () => {
        mounted = false;
      };
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: object | null) => {
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

    const supabase = createBrowserClient();
    const { data } = await supabase?.auth.getSession().catch(() => ({ data: { session: null } })) || { data: { session: null } };
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

  if (status === "hidden") return null;

  if (status === "checking") {
    return (
      <div className="onboarding-veil onboarding-veil-loading" role="status" aria-live="polite">
        <Loader2 className="action-spin" size={34} aria-hidden="true" />
        <p>Préparation de votre accueil...</p>
      </div>
    );
  }

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
