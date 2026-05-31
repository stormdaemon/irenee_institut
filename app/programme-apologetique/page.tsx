import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, CheckCircle2, Clock } from "lucide-react";
import { formatDuration } from "@/lib/data";
import { serializeJsonLd, siteUrl } from "@/lib/seo";
import { getPublicCourses } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Programme de formation en apologétique catholique",
  description:
    "Consultez le programme d'apologétique catholique de l'Institut Irénée : fondements, Bible, histoire, science, philosophie, objections et dialogue.",
  alternates: {
    canonical: "/programme-apologetique"
  },
  openGraph: {
    title: "Programme de formation en apologétique catholique",
    description:
      "Un parcours progressif pour comprendre, défendre et transmettre la foi catholique avec méthode.",
    url: "/programme-apologetique"
  }
};

const themes = [
  "Fondements bibliques et histoire de l'apologétique chrétienne",
  "Foi, raison, philosophie et arguments autour de l'existence de Dieu",
  "Fiabilité des Écritures, transmission et histoire du christianisme",
  "Science, objections contemporaines et grands débats culturels",
  "Dialogue interreligieux et présentation claire de la foi catholique",
  "Engagement public, pédagogie et charité dans la conversation"
];

export default async function ProgrammeApologetiquePage() {
  const courses = await getPublicCourses();
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Programme de formation en apologétique catholique",
    itemListElement: courses.map((course, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: course.titre,
      description: course.description
    }))
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Programme d'apologétique", item: `${siteUrl}/programme-apologetique` }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />

      <section className="page-hero">
        <div className="container center">
          <span className="hero-eyebrow">Parcours progressif</span>
          <h1 className="font-display" style={{ fontSize: "clamp(2.7rem, 5vw, 4.7rem)", margin: 0 }}>
            Programme de formation en apologétique catholique
          </h1>
          <p style={{ fontSize: "1.3rem", color: "#f0dfc2", maxWidth: 900, margin: "22px auto 0" }}>
            Des fondements aux approfondissements : un itinéraire pour apprendre à étudier une question et à
            répondre avec justesse.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 1040 }}>
          <h2 className="section-title">Comment est construit le programme ?</h2>
          <p className="subtitle">
            Le programme de l'Institut Irénée part des bases de l'apologétique chrétienne avant d'aborder les
            questions bibliques, historiques, philosophiques et culturelles. Cette progression permet d'éviter les
            réponses dispersées : chaque objection est replacée dans son domaine, ses sources et ses limites.
          </p>
          <div className="grid-2" style={{ marginTop: 34 }}>
            {themes.map(theme => (
              <p className="soft-card" key={theme} style={{ padding: 20, margin: 0 }}>
                <CheckCircle2 size={17} color="var(--gold-2)" /> {theme}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Les cours du programme</h2>
          <p className="subtitle center" style={{ maxWidth: 860, margin: "0 auto 36px" }}>
            Les parcours disponibles en ligne permettent de commencer par une introduction générale puis de choisir
            les approfondissements adaptés aux questions rencontrées.
          </p>
          <div className="grid-2">
            {courses.map(course => (
              <article className="card" key={course.id} style={{ padding: 28 }}>
                <span className="badge">{course.niveau}</span>
                <h3 style={{ color: "#fff7e7", fontSize: "1.55rem" }}>{course.titre}</h3>
                <p className="muted">{course.description}</p>
                <p className="muted">
                  <Clock size={15} /> {formatDuration(course.duree_totale)}{" "}
                  <BookOpen size={15} /> {course.nb_modules} modules
                </p>
              </article>
            ))}
          </div>
          <div className="center" style={{ marginTop: 36 }}>
            <Link className="btn btn-gold" href="/formations">
              Choisir une formation <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 className="section-title">Avant de commencer</h2>
          <p className="subtitle">
            Vous découvrez l'apologétique ? Commencez par l'introduction générale et par notre guide sur la nature de
            l'apologétique catholique. Vous pourrez ensuite approfondir un domaine particulier sans perdre la vue
            d'ensemble.
          </p>
          <p className="center">
            <Link className="btn btn-outline" href="/blog/qu-est-ce-que-l-apologetique-catholique">
              Lire le guide d'introduction <ArrowRight size={16} />
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
