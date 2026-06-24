import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, CheckCircle2, Laptop, MessagesSquare } from "lucide-react";
import { serializeJsonLd, siteUrl } from "@/lib/seo";

const questions = [
  {
    question: "Qu'est-ce qu'une école d'apologétique en ligne ?",
    answer:
      "Une école d'apologétique en ligne propose un parcours progressif pour étudier les raisons de croire, les sources de la foi et les objections contemporaines depuis chez soi. Elle doit donner une méthode, pas seulement une liste de réponses."
  },
  {
    question: "Quelle différence entre théologie et apologétique ?",
    answer:
      "La théologie étudie la foi dans son ensemble. L'apologétique se concentre plus particulièrement sur les raisons de croire, les signes de crédibilité et la manière de répondre aux objections avec justesse."
  },
  {
    question: "Peut-on apprendre l'apologétique à son rythme ?",
    answer:
      "Oui. Un parcours en ligne permet d'avancer régulièrement, de revenir sur les notions importantes et de choisir des approfondissements adaptés aux questions rencontrées."
  }
];

export const metadata: Metadata = {
  title: "École d'Apologétique en ligne",
  description:
    "Découvrez l'École d'Apologétique en ligne de l'Institut d'Apologétique Saint Irénée : une école apologétique catholique progressive pour étudier la foi et répondre aux objections.",
  keywords: ["école d'apologétique", "école apologétique", "école apologétique catholique", "formation apologétique en ligne"],
  alternates: {
    canonical: "/ecole-apologetique-en-ligne"
  },
  openGraph: {
    title: "École d'Apologétique en ligne | Institut Saint Irénée",
    description:
      "Une formation catholique progressive et accessible à distance pour comprendre, répondre et transmettre.",
    url: "/ecole-apologetique-en-ligne"
  }
};

export default function EcoleApologetiqueEnLignePage() {
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteUrl}/ecole-apologetique-en-ligne#webpage`,
    url: `${siteUrl}/ecole-apologetique-en-ligne`,
    name: "École d'Apologétique en ligne",
    alternateName: "École apologétique catholique en ligne",
    description:
      "Une formation catholique progressive et accessible à distance pour comprendre, répondre et transmettre.",
    isPartOf: {
      "@id": `${siteUrl}/#website`
    },
    about: {
      "@id": `${siteUrl}/#organization`
    }
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "École d'Apologétique en ligne", item: `${siteUrl}/ecole-apologetique-en-ligne` }
    ]
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(pageJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />

      <section className="page-hero">
        <div className="container center">
          <span className="hero-eyebrow">Se former à distance</span>
          <h1 className="font-display" style={{ fontSize: "clamp(2.8rem, 5vw, 4.8rem)", margin: 0 }}>
            École d'Apologétique en ligne
          </h1>
          <p style={{ fontSize: "1.3rem", color: "#f0dfc2", maxWidth: 900, margin: "22px auto 0" }}>
            Une formation catholique progressive pour comprendre la foi, travailler les sources et répondre avec
            clarté sans perdre la charité.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 1040 }}>
          <h2 className="section-title">Apprendre l'apologétique avec une méthode</h2>
          <p className="subtitle">
            Une école d'apologétique ne forme pas à réciter des phrases toutes faites. Elle apprend à écouter une
            question, à en distinguer les dimensions, à vérifier les faits et à revenir aux sources avant de
            répondre. Ce travail demande du temps : les questions sur Dieu, la Bible, l'Église, la science ou la
            morale ne relèvent pas toutes du même raisonnement.
          </p>
          <p className="subtitle">
            L'Institut Saint Irénée propose un parcours accessible en ligne. Cette modalité convient à ceux qui veulent
            progresser régulièrement depuis leur lieu de vie, reprendre un module important et relier l'étude à
            leurs conversations réelles : en famille, en paroisse, au travail ou sur internet.
          </p>
          <p className="subtitle">
            Cette école apologétique catholique en ligne conserve la même exigence : former une intelligence de la
            foi capable d'écouter, de vérifier et de répondre avec charité.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Trois gestes pour progresser</h2>
          <div className="grid-3" style={{ marginTop: 36 }}>
            <article className="soft-card" style={{ padding: 30 }}>
              <BookOpen size={32} color="var(--gold-2)" />
              <h3>Étudier</h3>
              <p className="muted">Lire les textes, comprendre le contexte et distinguer les faits des impressions.</p>
            </article>
            <article className="soft-card" style={{ padding: 30 }}>
              <MessagesSquare size={32} color="var(--gold-2)" />
              <h3>Formuler</h3>
              <p className="muted">Transformer l'étude en une réponse simple, précise et respectueuse de la personne.</p>
            </article>
            <article className="soft-card" style={{ padding: 30 }}>
              <Laptop size={32} color="var(--gold-2)" />
              <h3>Revenir aux modules</h3>
              <p className="muted">Approfondir un point au bon moment grâce à des cours disponibles en ligne.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 1040 }}>
          <h2 className="section-title">Un parcours pour les questions concrètes</h2>
          <div className="grid-2" style={{ marginTop: 34 }}>
            {[
              ["Commencer par définir l'apologétique et ses limites", "/blog/qu-est-ce-que-l-apologetique-catholique"],
              ["Articuler la foi et la raison sans fabriquer de conflit", "/blog/foi-et-raison-deux-lumieres"],
              ["Comprendre la transmission de la Bible et de la Tradition", "/blog/bible-tradition-magistere-une-meme-parole"],
              ["Répondre au problème du mal sans durcir le coeur", "/blog/probleme-du-mal-repondre-sans-durcir-le-coeur"],
              ["Parler de science avec précision et émerveillement", "/blog/science-et-foi-sortir-des-caricatures"],
              ["Garder un visage humain dans les conversations en ligne", "/blog/reseaux-sociaux-apologetique-verite-visage-humain"]
            ].map(([label, href]) => (
              <Link className="soft-card" href={href} key={label} style={{ display: "block", padding: 20 }}>
                <CheckCircle2 size={17} color="var(--gold-2)" /> {label}
              </Link>
            ))}
          </div>
          <div className="center" style={{ marginTop: 36 }}>
            <Link className="btn btn-gold" href="/formations?checkout=annual-pass">
              Obtenir le pass annuel <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 className="section-title">Questions fréquentes</h2>
          <div style={{ display: "grid", gap: 18, marginTop: 30 }}>
            {questions.map(item => (
              <article className="soft-card" key={item.question} style={{ padding: 24 }}>
                <h3 style={{ marginTop: 0 }}>{item.question}</h3>
                <p className="muted" style={{ marginBottom: 0 }}>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
