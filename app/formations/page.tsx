import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Award, BookOpen, CheckCircle2, Clock, User } from "lucide-react";
import { formatDuration, formatPrice } from "@/lib/data";
import { getCourses } from "@/lib/server-data";
import { BuyCourseButton } from "@/components/BuyCourseButton";
import { ANNUAL_PASS_NAME } from "@/lib/curriculum";
import { serializeJsonLd, siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formations en apologétique catholique en ligne",
  description:
    "Découvrez les formations en apologétique catholique de l'Institut Saint Irénée : foi et raison, Écritures, histoire, science, philosophie et dialogue.",
  alternates: {
    canonical: "/formations"
  }
};

const formationQuestions = [
  {
    question: "Comment suivre une formation en apologétique catholique en ligne ?",
    answer:
      "Les formations de l'Institut Saint Irénée sont organisées en modules accessibles en ligne. Chaque parcours permet d'étudier un thème, de progresser à son rythme et de retrouver les ressources pédagogiques dans l'espace étudiant."
  },
  {
    question: "Quel cours d'apologétique choisir pour commencer ?",
    answer:
      "Le parcours d'introduction générale à l'apologétique chrétienne est le meilleur point de départ. Il présente les fondements bibliques, historiques et méthodologiques avant les approfondissements thématiques."
  },
  {
    question: "Les formations abordent-elles la science, la Bible et la philosophie ?",
    answer:
      "Oui. Le programme couvre notamment la foi et la raison, la fiabilité des Écritures, l'histoire du christianisme, les objections contemporaines, la science, la philosophie et le dialogue interreligieux."
  }
];

export default async function FormationsPage() {
  const courses = await getCourses();
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteUrl}/formations#webpage`,
    url: `${siteUrl}/formations`,
    name: "Formations en apologétique catholique en ligne",
    description:
      "Parcours et cours en ligne de l'Institut Saint Irénée pour comprendre, défendre et transmettre la foi catholique.",
    isPartOf: {
      "@id": `${siteUrl}/#website`
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: courses.map((course, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: course.titre,
        description: course.description
      }))
    }
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: formationQuestions.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />
      <section className="page-hero">
        <div className="container">
          <span className="hero-eyebrow">Cours accessibles à distance</span>
          <h1 className="font-display" style={{ fontSize: "clamp(2.7rem, 5vw, 4.6rem)", margin: 0 }}>
            Formations en apologétique catholique en ligne
          </h1>
          <p style={{ fontSize: "1.3rem", color: "#dce6f6", maxWidth: 760 }}>
            Des cours structurés par modules pour approfondir la foi, travailler les sources et apprendre à répondre
            aux objections contemporaines.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container" style={{ maxWidth: 1040 }}>
          <h2 className="section-title">Choisir un cours d'apologétique catholique</h2>
          <p className="subtitle">
            L'apologétique ne se résume pas à quelques réponses mémorisées. Une formation solide commence par les
            fondements, puis approfondit les questions bibliques, historiques, philosophiques et contemporaines.
            L'Institut Saint Irénée propose plusieurs portes d'entrée afin que chacun puisse construire un parcours
            cohérent.
          </p>
          <div className="grid-3" style={{ marginTop: 30 }}>
            {[
              "Commencer par les fondements bibliques et méthodologiques",
              "Approfondir un thème précis : Écritures, science, philosophie ou dialogue",
              "Progresser à son rythme avec des modules disponibles en ligne"
            ].map(item => (
              <p className="soft-card" key={item} style={{ padding: 20, margin: 0 }}>
                <CheckCircle2 size={17} color="var(--gold-2)" /> {item}
              </p>
            ))}
          </div>
          <p className="center" style={{ marginTop: 28 }}>
            <Link className="btn btn-outline" href="/programme-apologetique">
              Consulter le programme d'apologétique <ArrowRight size={16} />
            </Link>
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container" style={{ maxWidth: 980 }}>
          <div className="card" style={{ padding: 34 }}>
            <span className="badge">Année scolaire complète</span>
            <h2 className="font-display" style={{ color: "var(--navy)", fontSize: "2rem" }}>{ANNUAL_PASS_NAME}</h2>
            <p className="subtitle">
              Un accès illimité pendant 365 jours à l'ensemble du cursus, aux cours déjà publiés et aux nouveaux contenus
              ajoutés pendant votre année scolaire.
            </p>
            <p style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span><CheckCircle2 size={17} color="#22c55e" /> Cursus progressif</span>
              <span><CheckCircle2 size={17} color="#22c55e" /> Parchemins de connaissance</span>
              <span><CheckCircle2 size={17} color="#22c55e" /> Examen final</span>
              <span><CheckCircle2 size={17} color="#22c55e" /> Certificat nominatif</span>
            </p>
            <div className="course-card-actions">
              <strong style={{ color: "var(--navy)", fontSize: "1.4rem" }}>{formatPrice(9900)} conseillés / participation libre</strong>
              <BuyCourseButton />
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container grid-2">
          {courses.map(course => (
            <div className="card" key={course.id} style={{ padding: 30 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 0 }}>{course.titre}</h2>
                <strong style={{ color: "var(--navy)", fontSize: "1.35rem", textAlign: "right" }}>
                  Inclus
                  <small style={{ display: "block", fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>dans le pass annuel</small>
                </strong>
              </div>
              <p className="muted">{course.description}</p>
              <p style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "var(--muted)" }}>
                <span><Clock size={16} /> {formatDuration(course.duree_totale)}</span>
                <span><BookOpen size={16} /> {course.nb_modules} modules</span>
                <span><User size={16} /> {course.auteur_nom || "Institut Saint Irénée"}</span>
                <span><Award size={16} /> Certificat</span>
              </p>
              <div className="course-card-actions">
                <Link className="btn btn-outline" href={`/cours/${course.slug}`}>Voir le cours <ArrowRight size={16} /></Link>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 className="section-title">Questions fréquentes sur les formations</h2>
          <div style={{ display: "grid", gap: 18, marginTop: 30 }}>
            {formationQuestions.map(item => (
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
