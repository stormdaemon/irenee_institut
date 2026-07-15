import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Clock, Euro, GraduationCap, Laptop, MapPin, Users } from "lucide-react";
import { siteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

const questions = [
  {
    question: "Formation d'apologétique en ligne ou en présentiel : que choisir ?",
    answer:
      "Les deux formats sont sérieux et répondent à des situations différentes. Le présentiel convient si vous habitez près du lieu des sessions, si votre agenda permet des week-ends ou soirées fixes et si vous cherchez d'abord la dynamique de groupe. La formation en ligne convient si vous voulez avancer à votre rythme, revenir sur les modules, ou si aucune offre en présentiel n'existe près de chez vous."
  },
  {
    question: "Faut-il habiter Paris pour se former à l'apologétique ?",
    answer:
      "Non. La plupart des formations d'apologétique en présentiel sont concentrées à Paris, mais une formation en ligne structurée donne accès au même travail des sources, avec un suivi pédagogique, depuis toute la francophonie."
  },
  {
    question: "Quel budget prévoir pour une formation d'apologétique ?",
    answer:
      "Les cursus en présentiel sur une ou deux années impliquent généralement des frais d'inscription, plus les déplacements et éventuels hébergements. Les formations en ligne réduisent fortement ces coûts. À l'Institut Saint Irénée, le pass annuel est en participation libre avec un prix conseillé de 99 euros, pour rester accessible à tous."
  },
  {
    question: "À quoi reconnaît-on une formation d'apologétique sérieuse ?",
    answer:
      "Un programme publié et progressif, des sources citées et vérifiables (Écriture, Catéchisme, conciles, Pères de l'Église), une fidélité claire au Magistère, des formateurs identifiés, une évaluation réelle du travail et un style qui unit vérité et charité, sans polémique."
  }
];

const criteres = [
  {
    icon: MapPin,
    title: "Le format",
    text: "Présentiel (sessions à date fixe, souvent à Paris), en ligne (accessible partout, à son rythme) ou mixte. Le bon format est celui que vous pourrez tenir dans la durée."
  },
  {
    icon: Clock,
    title: "Le rythme",
    text: "Un week-end par mois pendant deux ans, des soirées hebdomadaires ou une progression libre : vérifiez la compatibilité avec votre vie familiale, étudiante ou professionnelle."
  },
  {
    icon: Euro,
    title: "Le coût réel",
    text: "Ajoutez aux frais d'inscription les déplacements et l'hébergement pour les formats en présentiel. Comparez le coût complet, pas seulement le tarif affiché."
  },
  {
    icon: GraduationCap,
    title: "Le contenu",
    text: "Sources de la foi, fiabilité des Évangiles, philosophie, histoire de l'Église, science et foi, méthode de dialogue : le programme doit être publié, progressif et sourcé."
  },
  {
    icon: Users,
    title: "L'accompagnement",
    text: "Qui corrige vos travaux ? Pouvez-vous poser des questions ? Une formation sérieuse prévoit une évaluation et un suivi, quel que soit le format."
  },
  {
    icon: Laptop,
    title: "L'accès aux contenus",
    text: "Pouvez-vous revoir un cours, reprendre un module, avancer pendant les vacances ? L'accès durable aux contenus fait la différence sur deux ans d'étude."
  }
];

export const metadata: Metadata = {
  title: "Choisir sa formation d'apologétique catholique : le guide",
  description:
    "Formation d'apologétique en présentiel ou en ligne ? Critères objectifs, budget, rythme, contenu et accompagnement : le guide pour choisir la formation adaptée à votre situation.",
  keywords: [
    "choisir formation apologétique",
    "formation apologétique catholique",
    "formation apologétique en ligne",
    "formation apologétique présentiel",
    "école d'apologétique"
  ],
  alternates: {
    canonical: "/choisir-formation-apologetique"
  },
  openGraph: {
    title: "Choisir sa formation d'apologétique catholique | Institut Saint Irénée",
    description:
      "Présentiel ou en ligne, rythme, budget, programme : les critères objectifs pour choisir votre formation d'apologétique.",
    url: "/choisir-formation-apologetique"
  }
};

export default function ChoisirFormationApologetiquePage() {
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteUrl}/choisir-formation-apologetique#webpage`,
    url: `${siteUrl}/choisir-formation-apologetique`,
    name: "Choisir sa formation d'apologétique catholique",
    description:
      "Les critères objectifs pour choisir une formation d'apologétique catholique : format, rythme, budget, contenu et accompagnement.",
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
      { "@type": "ListItem", position: 2, name: "Choisir sa formation d'apologétique", item: `${siteUrl}/choisir-formation-apologetique` }
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
      <JsonLd data={pageJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />

      <section className="page-hero">
        <div className="container center">
          <span className="hero-eyebrow">Guide de choix</span>
          <h1 className="font-display" style={{ fontSize: "clamp(2.6rem, 5vw, 4.4rem)", margin: 0 }}>
            Choisir sa formation d'apologétique catholique
          </h1>
          <p style={{ fontSize: "1.3rem", color: "#f0dfc2", maxWidth: 900, margin: "22px auto 0" }}>
            L'apologétique attire de plus en plus de catholiques, et plusieurs formations sérieuses existent
            aujourd'hui en France. Voici les critères objectifs pour choisir celle qui correspond à votre
            situation.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 1040 }}>
          <h2 className="section-title">Une bonne nouvelle : l'offre grandit</h2>
          <p className="subtitle">
            Écoles diocésaines, parcours associatifs, cursus en présentiel à Paris, formations en ligne : le
            renouveau de l'apologétique en France multiplie les propositions. C'est une chance pour l'Église, et
            cela rend le choix plus exigeant. Aucun format n'est supérieur en soi : une formation ne porte du
            fruit que si vous pouvez la suivre jusqu'au bout.
          </p>
          <p className="subtitle">
            Avant de comparer les programmes, posez-vous trois questions simples : combien d'heures par semaine
            puis-je réellement consacrer à l'étude ? Puis-je me déplacer régulièrement, ou ai-je besoin d'un accès
            à distance ? Quel budget complet puis-je engager sur l'année ?
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Six critères pour comparer</h2>
          <div className="grid-3" style={{ marginTop: 36 }}>
            {criteres.map(item => (
              <article className="soft-card" key={item.title} style={{ padding: 30 }}>
                <item.icon size={32} color="var(--gold-2)" />
                <h3>{item.title}</h3>
                <p className="muted">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 1040 }}>
          <h2 className="section-title">Ce que propose l'Institut Saint Irénée</h2>
          <p className="subtitle">
            Notre parti pris est l'accessibilité sans rabais sur l'exigence : une formation entièrement en ligne,
            que vous suivez à votre rythme depuis chez vous, avec des modules progressifs, des évaluations
            corrigées, un examen final et un certificat nominatif. Le pass annuel est en participation libre
            (prix conseillé : 99 euros) afin que la question financière n'écarte personne de l'étude.
          </p>
          <div className="grid-2" style={{ marginTop: 34 }}>
            {[
              ["Découvrir le programme complet", "/programme-apologetique"],
              ["Voir les formations et le pass annuel", "/formations"],
              ["Comprendre la méthode de l'école en ligne", "/ecole-apologetique-en-ligne"],
              ["Lire le dossier : la fiabilité des Évangiles", "/blog/fiabilite-des-evangiles-dossier"]
            ].map(([label, href]) => (
              <Link className="soft-card" href={href} key={label} style={{ display: "block", padding: 20 }}>
                <CheckCircle2 size={17} color="var(--gold-2)" /> {label}
              </Link>
            ))}
          </div>
          <div className="center" style={{ marginTop: 36 }}>
            <Link className="btn btn-gold" href="/formations?checkout=annual-pass">
              Commencer la formation en ligne <ArrowRight size={17} />
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
