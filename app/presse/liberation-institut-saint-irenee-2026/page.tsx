import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ExternalLink, Newspaper } from "lucide-react";

const liberationUrl = "https://www.liberation.fr/societe/religions/avec-linstitut-saint-irenee-le-catholicisme-identitaire-se-met-en-ordre-de-bataille-20260617_64O26CD53FD5DOSYZZBIKXWRUA/";

export const metadata: Metadata = {
  title: "Libération parle de l'Institut Saint Irénée",
  description: "Revue de presse : Libération consacre un article à l'Institut Saint Irénée, à la formation catholique, à l'apologétique et à la place du catholicisme dans le débat public.",
  alternates: {
    canonical: "/presse/liberation-institut-saint-irenee-2026"
  },
  openGraph: {
    title: "Libération parle de l'Institut Saint Irénée",
    description: "Un article national sur l'Institut Saint Irénée, l'apologétique catholique et la formation intellectuelle chrétienne.",
    url: "/presse/liberation-institut-saint-irenee-2026",
    images: ["/images/presse-liberation-institut-saint-irenee.png"]
  }
};

const themes = [
  "Institut Saint Irénée",
  "apologétique catholique",
  "formation chrétienne",
  "catholicisme en France",
  "foi et raison",
  "transmission",
  "débat public",
  "jeunes catholiques"
];

export default function LiberationPressPage() {
  return (
    <>
      <section className="press-hero">
        <Image
          src="/images/presse-liberation-institut-saint-irenee.png"
          alt="Revue de presse de l'Institut Saint Irénée"
          fill
          priority
          sizes="100vw"
        />
        <div className="press-hero-overlay" />
        <div className="container">
          <Link className="press-back-link" href="/">← Retour à l'accueil</Link>
          <span className="hero-eyebrow"><Newspaper size={16} /> Revue de presse</span>
          <h1 className="font-display">Libération consacre un article à l'Institut Saint Irénée</h1>
          <p>
            Le 17 juin 2026, Libération publie un article consacré à l'Institut Saint Irénée et à la place
            de l'apologétique catholique dans le paysage religieux, intellectuel et culturel français.
          </p>
          <div className="press-actions">
            <a className="btn btn-gold" href={liberationUrl} target="_blank" rel="noreferrer">
              Lire l'article sur Libération <ExternalLink size={17} />
            </a>
            <Link className="btn btn-outline" href="/formations">
              Découvrir nos formations <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section press-page-section">
        <div className="container press-article-layout">
          <article className="card press-summary-card">
            <span className="badge">Presse nationale</span>
            <h2 className="font-display">Pourquoi cette publication compte</h2>
            <p>
              Cette prise de parole médiatique rend visible une question centrale : comment former des catholiques
              capables de comprendre leur foi, de travailler les sources chrétiennes et de répondre aux objections
              contemporaines avec rigueur, clarté et charité.
            </p>
            <p>
              L'article inscrit l'Institut Saint Irénée dans un débat plus large autour du catholicisme en France,
              de la transmission, de la formation intellectuelle, de l'engagement des jeunes croyants et de la place
              de la foi chrétienne dans l'espace public.
            </p>
            <p>
              Notre réponse reste simple : proposer un parcours d'apologétique catholique exigeant, enraciné dans
              l'Écriture, la Tradition, les Pères de l'Église, les conciles, la philosophie, l'histoire et le dialogue.
            </p>
          </article>

          <aside className="card press-keywords-card">
            <h2 className="font-display">Thèmes abordés</h2>
            <div className="press-keyword-list">
              {themes.map(theme => <span key={theme}>{theme}</span>)}
            </div>
            <a className="press-source-link" href={liberationUrl} target="_blank" rel="noreferrer">
              Source : Libération, 17 juin 2026 <ExternalLink size={15} />
            </a>
          </aside>
        </div>
      </section>
    </>
  );
}
