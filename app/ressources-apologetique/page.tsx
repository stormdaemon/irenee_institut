import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, ExternalLink } from "lucide-react";
import { serializeJsonLd, siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Ressources d'apologétique catholique",
  description:
    "Explorez les ressources d'apologétique catholique de l'Institut Irénée : guides, articles, sources doctrinales et parcours de lecture.",
  alternates: {
    canonical: "/ressources-apologetique"
  },
  openGraph: {
    title: "Ressources d'apologétique catholique | Institut Irénée",
    description:
      "Des parcours de lecture pour approfondir la foi, travailler les sources et répondre avec méthode.",
    url: "/ressources-apologetique"
  }
};

const readingPaths = [
  {
    title: "Commencer en apologétique",
    description: "Comprendre la démarche, son but et son style avant d'aborder les objections particulières.",
    links: [
      ["Qu'est-ce que l'apologétique catholique ?", "/blog/qu-est-ce-que-l-apologetique-catholique"],
      ["Pourquoi former des apologètes aujourd'hui ?", "/blog/pourquoi-former-des-apologetes-aujourd-hui"],
      ["1 Pierre 3,15 : rendre compte de l'espérance", "/blog/rendre-compte-esperance-1-pierre-3-15"]
    ]
  },
  {
    title: "Bible, Tradition et histoire",
    description: "Revenir aux textes, à leur transmission et aux grands repères de l'histoire chrétienne.",
    links: [
      ["Bible, Tradition, Magistère : une même Parole", "/blog/bible-tradition-magistere-une-meme-parole"],
      ["Manuscrits bibliques : une histoire solide", "/blog/manuscrits-bibliques-histoire-solide"],
      ["Le Credo de Nicée : garder le visage du Christ", "/blog/credo-nicee-garder-visage-du-christ"]
    ]
  },
  {
    title: "Raison, science et objections",
    description: "Distinguer les questions philosophiques, scientifiques et existentielles avant de répondre.",
    links: [
      ["Foi et raison : deux lumières", "/blog/foi-et-raison-deux-lumieres"],
      ["Science et foi : sortir des caricatures", "/blog/science-et-foi-sortir-des-caricatures"],
      ["Le problème du mal : répondre sans durcir le coeur", "/blog/probleme-du-mal-repondre-sans-durcir-le-coeur"]
    ]
  },
  {
    title: "Dialoguer dans le monde contemporain",
    description: "Parler avec clarté, refuser le mépris et garder une parole vraiment chrétienne.",
    links: [
      ["Parler aux athées sans mépris", "/blog/parler-aux-athees-sans-mepris"],
      ["Dialogue avec l'islam : clarté, respect, Christ", "/blog/dialogue-avec-islam-clarte-respect-christ"],
      ["Réseaux sociaux : la vérité avec visage humain", "/blog/reseaux-sociaux-apologetique-verite-visage-humain"]
    ]
  }
];

const primarySources = [
  ["Catéchisme de l'Église catholique", "https://www.vatican.va/archive/FRA0013/_INDEX.HTM"],
  ["Concile Vatican II, Dei Verbum", "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_fr.html"],
  ["Jean-Paul II, Fides et Ratio", "https://www.vatican.va/content/john-paul-ii/fr/encyclicals/documents/hf_jp-ii_enc_14091998_fides-et-ratio.html"],
  ["Évangile selon saint Jean 10", "https://www.aelf.org/bible/Jn/10"]
];

export default function RessourcesApologetiquePage() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Ressources d'apologétique catholique",
    itemListElement: readingPaths.flatMap(path => path.links).map(([title, href], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: title,
      url: `${siteUrl}${href}`
    }))
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Ressources d'apologétique", item: `${siteUrl}/ressources-apologetique` }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />

      <section className="page-hero">
        <div className="container center">
          <span className="hero-eyebrow">Guides et sources</span>
          <h1 className="font-display" style={{ fontSize: "clamp(2.8rem, 5vw, 4.8rem)", margin: 0 }}>
            Ressources d'apologétique catholique
          </h1>
          <p style={{ fontSize: "1.3rem", color: "#f0dfc2", maxWidth: 900, margin: "22px auto 0" }}>
            Des parcours de lecture pour travailler une question, revenir aux sources et progresser avec ordre.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 1040 }}>
          <h2 className="section-title">Une bibliothèque de travail, pas une accumulation de liens</h2>
          <p className="subtitle">
            Une ressource devient utile lorsqu'elle aide à avancer. Cette page organise les articles de l'Institut
            Irénée en parcours simples : commencer par la méthode, revenir aux textes, distinguer les domaines puis
            apprendre à parler avec justesse. Chaque dossier peut être lu seul ou servir de préparation à une
            formation plus structurée.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Parcours de lecture</h2>
          <div className="grid-2" style={{ marginTop: 36 }}>
            {readingPaths.map(path => (
              <article className="soft-card" key={path.title} style={{ padding: 28 }}>
                <BookOpen size={27} color="var(--gold-2)" />
                <h3>{path.title}</h3>
                <p className="muted">{path.description}</p>
                <div style={{ display: "grid", gap: 10 }}>
                  {path.links.map(([label, href]) => (
                    <Link className="feature-link" href={href} key={href}>
                      {label} <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 className="section-title">Sources primaires à consulter</h2>
          <p className="subtitle">
            Les articles orientent la lecture ; ils ne remplacent pas les textes de référence. Pour approfondir,
            consultez directement ces sources.
          </p>
          <div style={{ display: "grid", gap: 14, marginTop: 26 }}>
            {primarySources.map(([label, href]) => (
              <a className="soft-card" href={href} key={href} target="_blank" rel="noreferrer" style={{ display: "block", padding: 18 }}>
                {label} <ExternalLink size={15} />
              </a>
            ))}
          </div>
          <p className="center" style={{ marginTop: 34 }}>
            <Link className="btn btn-gold" href="/formations">
              Passer des ressources à la formation <ArrowRight size={17} />
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
