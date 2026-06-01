import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, MessagesSquare } from "lucide-react";
import { serializeJsonLd, siteUrl } from "@/lib/seo";

const questions = [
  {
    question: "Qu'est-ce que l'apologétique catholique ?",
    answer:
      "L'apologétique catholique consiste à exposer les raisons de croire, à étudier les sources et à répondre aux objections avec rigueur et charité. Elle ne remplace ni la foi ni la vie spirituelle : elle aide à rendre l'espérance chrétienne intelligible."
  },
  {
    question: "À qui s'adressent les formations de l'Institut Irénée ?",
    answer:
      "Les parcours s'adressent aux catholiques qui souhaitent approfondir leur foi et mieux la transmettre : étudiants, jeunes professionnels, catéchistes, missionnaires et créateurs de contenu."
  },
  {
    question: "Peut-on se former en ligne ?",
    answer:
      "Oui. Les formations de l'Institut Irénée sont accessibles en ligne et structurées par modules pour permettre une progression régulière, avec des contenus, des exercices et un accompagnement pédagogique."
  },
  {
    question: "Quels sujets sont abordés ?",
    answer:
      "Les formations abordent notamment la foi et la raison, la fiabilité des Écritures, l'histoire de l'Église, les objections contemporaines, les relations entre science et foi, la philosophie et le dialogue interreligieux."
  }
];

export const metadata: Metadata = {
  title: "Institut d'Apologétique catholique en ligne",
  description:
    "Découvrez l'Institut d'Apologétique Saint Irénée : une formation catholique en ligne pour approfondir la foi, étudier les sources et répondre aux objections.",
  alternates: {
    canonical: "/institut-apologetique"
  },
  openGraph: {
    title: "Institut d'Apologétique Saint Irénée",
    description:
      "Une formation catholique en ligne pour comprendre, défendre et transmettre la foi avec rigueur et charité.",
    url: "/institut-apologetique"
  }
};

export default function InstitutApologetiquePage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: siteUrl
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Institut d'Apologétique",
        item: `${siteUrl}/institut-apologetique`
      }
    ]
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };

  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteUrl}/institut-apologetique#webpage`,
    url: `${siteUrl}/institut-apologetique`,
    name: "Institut d'Apologétique Saint Irénée",
    description:
      "Une formation catholique en ligne pour comprendre, défendre et transmettre la foi avec rigueur et charité.",
    isPartOf: {
      "@id": `${siteUrl}/#website`
    },
    about: {
      "@id": `${siteUrl}/#organization`
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(pageJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />

      <section className="page-hero">
        <div className="container center">
          <span className="hero-eyebrow">Formation catholique en ligne</span>
          <h1
            className="font-display"
            style={{ fontSize: "clamp(2.7rem, 5vw, 4.45rem)", lineHeight: 1.04, maxWidth: 1040, margin: "0 auto" }}
          >
            Institut d'Apologétique Saint Irénée
          </h1>
          <p style={{ fontSize: "1.3rem", color: "#f0dfc2", maxWidth: 900, margin: "22px auto 0" }}>
            Approfondir la foi, étudier les sources et apprendre à répondre avec intelligence, précision et charité.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 1040 }}>
          <h2 className="section-title">Qu'est-ce qu'un institut d'apologétique ?</h2>
          <p className="subtitle">
            Un institut d'apologétique donne une méthode pour présenter les raisons de croire sans réduire la foi à
            une collection de formules. Il apprend à distinguer les questions historiques, bibliques, philosophiques
            et pastorales, puis à chercher les sources adaptées avant de répondre.
          </p>
          <p className="subtitle">
            L'Institut Irénée inscrit ce travail dans la tradition catholique. Ses parcours relient l'Écriture, la
            Tradition apostolique, le Magistère, l'histoire de l'Église et les grandes questions contemporaines. La
            formation reste orientée vers la mission : parler clairement sans humilier, argumenter sans perdre la
            charité et reconnaître ce qui demande encore du travail.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Une formation structurée pour rendre compte de l'espérance</h2>
          <p className="subtitle center" style={{ maxWidth: 840, margin: "0 auto 38px" }}>
            Les modules avancent progressivement afin de construire une compréhension solide et une parole ajustée.
          </p>
          <div className="grid-3">
            <article className="soft-card" style={{ padding: 30 }}>
              <BookOpen size={32} color="var(--gold-2)" />
              <h3>Étudier les sources</h3>
              <p className="muted">
                Lire les textes bibliques, les repères doctrinaux et les faits historiques avant de formuler une
                réponse.
              </p>
            </article>
            <article className="soft-card" style={{ padding: 30 }}>
              <MessagesSquare size={32} color="var(--gold-2)" />
              <h3>Répondre avec méthode</h3>
              <p className="muted">
                Comprendre l'objection, distinguer ses niveaux et proposer une réponse claire sans caricaturer
                l'interlocuteur.
              </p>
            </article>
            <article className="soft-card" style={{ padding: 30 }}>
              <GraduationCap size={32} color="var(--gold-2)" />
              <h3>Progresser en ligne</h3>
              <p className="muted">
                Suivre des modules accessibles à distance et avancer régulièrement dans un parcours cohérent.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 1040 }}>
          <h2 className="section-title">Les grands thèmes de l'apologétique catholique</h2>
          <div className="grid-2" style={{ marginTop: 34 }}>
            {[
              ["Foi et raison : articuler confiance, intelligence et recherche de la vérité", "/blog/foi-et-raison-deux-lumieres"],
              ["Écritures : comprendre la transmission et la fiabilité des textes bibliques", "/blog/manuscrits-bibliques-histoire-solide"],
              ["Histoire de l'Église : regarder les faits, les conciles et les objections avec précision", "/blog/credo-nicee-garder-visage-du-christ"],
              ["Science et foi : distinguer les méthodes et sortir des faux conflits", "/blog/science-et-foi-sortir-des-caricatures"],
              ["Philosophie : travailler les grandes questions sur Dieu, le mal et la liberté", "/blog/preuves-de-dieu-chemins-de-raison"],
              ["Dialogue : répondre aux objections contemporaines avec fermeté et respect", "/blog/dialogue-avec-islam-clarte-respect-christ"]
            ].map(([item, href]) => (
              <Link className="soft-card" href={href} key={item} style={{ display: "block", padding: 20, margin: 0 }}>
                <CheckCircle2 size={18} color="var(--gold-2)" /> {item}
              </Link>
            ))}
          </div>
          <div className="center" style={{ marginTop: 36 }}>
            <Link className="btn btn-gold" href="/formations">
              Voir les formations <ArrowRight size={17} />
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

      <section className="section">
        <div className="container">
          <h2 className="section-title">Approfondir avec l'Institut Irénée</h2>
          <div className="grid-3" style={{ marginTop: 34 }}>
            {[
              ["École d'Apologétique en ligne", "Comprendre la méthode d'apprentissage à distance.", "/ecole-apologetique-en-ligne"],
              ["Programme d'apologétique", "Voir la progression et les cours disponibles.", "/programme-apologetique"],
              ["Ressources d'apologétique", "Explorer les parcours de lecture et les sources.", "/ressources-apologetique"]
            ].map(([title, description, href]) => (
              <article className="soft-card" key={href} style={{ padding: 24 }}>
                <h3 style={{ marginTop: 0 }}>{title}</h3>
                <p className="muted">{description}</p>
                <Link className="feature-link" href={href}>
                  Découvrir <ArrowRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section hero-band center">
        <div className="container">
          <h2 className="font-display" style={{ fontSize: "2.7rem", margin: 0 }}>
            Commencer à se former en apologétique
          </h2>
          <p style={{ color: "#f0dfc2" }}>
            Explorez les parcours ou découvrez les premiers repères dans le blog de l'Institut Irénée.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-gold" href="/formations">Découvrir les formations</Link>
            <Link className="btn btn-outline" href="/blog/qu-est-ce-que-l-apologetique-catholique">
              Lire l'introduction
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
