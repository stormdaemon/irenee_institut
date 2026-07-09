import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Award, BookOpen, CheckCircle2, Clock, CreditCard, ShieldCheck, User } from "lucide-react";
import { formatDuration, formatPrice } from "@/lib/data";
import { getCourses } from "@/lib/server-data";
import { BuyCourseButton } from "@/components/BuyCourseButton";
import { ANNUAL_PASS_NAME } from "@/lib/curriculum";
import { siteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

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
    question: "Que contient le pass annuel de l'Institut Saint Irénée ?",
    answer:
      "Le pass annuel donne accès pendant 365 jours à l'ensemble du cursus d'apologétique : les cours déjà publiés, les nouveaux contenus ajoutés pendant l'année, les validations de progression, les parchemins de connaissance, l'examen final et le certificat nominatif lorsque les conditions sont remplies."
  },
  {
    question: "Que se passe-t-il juste après le paiement ?",
    answer:
      "Après confirmation du paiement en ligne, le pass est activé automatiquement sur votre compte. Vous êtes redirigé vers votre espace étudiant, où les cours du cursus apparaissent avec votre progression, les séances en direct et les documents pédagogiques."
  },
  {
    question: "Pourquoi le prix est-il indiqué comme participation libre ?",
    answer:
      "Le prix conseillé est de 99 euros pour l'année scolaire. La participation libre permet aux étudiants de contribuer selon leurs moyens tout en soutenant l'accessibilité de la formation."
  },
  {
    question: "Le certificat est-il un diplôme universitaire ?",
    answer:
      "Non. Le certificat nominatif atteste l'achèvement du cursus et la réussite des validations prévues par l'Institut Saint Irénée. Il ne s'agit pas d'un diplôme universitaire national ni d'une habilitation professionnelle réglementée."
  },
  {
    question: "Puis-je consulter le programme avant d'acheter ?",
    answer:
      "Oui. La page présente les cours inclus dans le pass annuel et renvoie vers le programme d'apologétique pour comprendre la progression pédagogique avant de créer un compte ou de payer."
  },
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

const passHighlights = [
  "Première formation francophone en apologétique",
  "Premières rencontres en visio conférence à partir de septembre 2026",
  "Accès complet au cursus pendant 365 jours",
  "Cours déjà publiés et nouveaux contenus de l'année",
  "Progression visible dans l'espace étudiant",
  "Parchemins de connaissance et certificat nominatif",
  "Séances en direct et ressources pédagogiques"
];

const reassuranceItems = [
  ["Paiement sécurisé", "Stripe traite le règlement et confirme automatiquement l'activation du pass."],
  ["Compte personnel", "Vos cours, validations, documents et certificats restent rattachés à votre espace étudiant."],
  ["Prix accessible", "99 € conseillés, avec une participation libre pour ne pas bloquer les étudiants motivés."],
  ["Cadre légal clair", "Mentions légales, CGV, confidentialité, association porteuse et SIREN sont disponibles en pied de page."]
];

export default async function FormationsPage() {
  const courses = await getCourses();
  const totalModules = courses.reduce((sum, course) => sum + Number(course.nb_modules || course.modules.length || 0), 0);
  const totalMinutes = courses.reduce((sum, course) => sum + Number(course.duree_totale || 0), 0);
  const totalHours = Math.round(totalMinutes / 60);
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
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={faqJsonLd} />
      <section className="page-hero">
        <div className="container">
          <span className="hero-eyebrow">Cours accessibles à distance</span>
          <h1 className="font-display" style={{ fontSize: "clamp(2.7rem, 5vw, 4.6rem)", margin: 0 }}>
            Formations en apologétique catholique en ligne
          </h1>
          <p style={{ fontSize: "1.3rem", color: "#dce6f6", maxWidth: 840 }}>
            Un pass annuel pour accéder au cursus complet : fondements, Écritures, histoire, objections, science,
            philosophie, morale et dialogue interreligieux.
          </p>
          <div className="formation-hero-highlights">
            <span>Première formation francophone en apologétique</span>
            <span>Premières rencontres en visio conférence à partir de septembre 2026</span>
          </div>
          <div className="hero-actions formation-hero-actions">
            <Link className="btn btn-gold" href="/formations?checkout=annual-pass">
              Obtenir le pass annuel <ArrowRight size={18} />
            </Link>
            <Link className="btn btn-outline" href="/programme-apologetique">
              Voir le programme détaillé
            </Link>
          </div>
        </div>
      </section>

      <section className="section annual-pass-section" id="pass-annuel">
        <div className="container annual-pass-panel">
          <div className="annual-pass-heading">
            <span className="badge">Année scolaire complète</span>
            <h2 className="font-display">{ANNUAL_PASS_NAME}</h2>
            <p className="annual-pass-lead">
              Accédez à l'ensemble des cours pendant 365 jours, avancez module après module et retrouvez tous vos
              contenus dans un espace étudiant personnel dès confirmation du paiement.
            </p>
          </div>
          <aside className="annual-pass-aside" aria-label="Achat du pass annuel">
            <p className="pass-price">
              <strong>{formatPrice(9900)}</strong>
              <span>conseillés / participation libre</span>
            </p>
            <BuyCourseButton />
            <p className="payment-note">
              <ShieldCheck size={17} /> Paiement sécurisé par Stripe. Activation automatique du pass après confirmation.
            </p>
            <p className="payment-note">
              <CreditCard size={17} /> Vous pouvez ajuster librement le montant dans la fenêtre de paiement selon vos moyens.
            </p>
          </aside>
          <div className="annual-pass-main">
            <div className="pass-stat-grid" aria-label="Contenu du pass annuel">
              <span><strong>{courses.length || 10}</strong><small>cours inclus</small></span>
              <span><strong>{totalModules || 50}</strong><small>modules</small></span>
              <span><strong>{totalHours || 125}h</strong><small>environ</small></span>
              <span><strong>365</strong><small>jours d'accès</small></span>
            </div>
            <div className="pass-checklist">
              {passHighlights.map(item => (
                <span key={item}><CheckCircle2 size={18} /> {item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="programme-inclus">
        <div className="container">
          <div className="programme-head">
            <span className="hero-eyebrow">Programme inclus dans le pass</span>
            <h2 className="section-title">Un cursus complet pour comprendre, répondre et transmettre</h2>
            <p className="subtitle center">
              Chaque cours est inclus dans le pass annuel. Les cartes ci-dessous vous donnent le périmètre concret
              avant achat : thème, durée, modules, intervenant et certification associée.
            </p>
          </div>
          <div className="grid-2 course-included-grid">
            {courses.map(course => (
              <article className="course-included-card" key={course.id}>
                <div className="course-included-top">
                  <span className="badge">{course.niveau}</span>
                  <strong>Inclus dans le pass</strong>
                </div>
                <h3 className="font-display">{course.titre}</h3>
                <p className="muted">{course.description}</p>
                <p className="course-included-meta">
                  <span><Clock size={16} /> {formatDuration(course.duree_totale)}</span>
                  <span><BookOpen size={16} /> {course.nb_modules} modules</span>
                  <span><User size={16} /> {course.auteur_nom || "Institut Saint Irénée"}</span>
                  <span><Award size={16} /> Certificat</span>
                </p>
                <Link className="feature-link" href="/formations?checkout=annual-pass">
                  Accéder avec le pass annuel <ArrowRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 1040 }}>
          <h2 className="section-title">Comment le cursus est construit</h2>
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

      <section className="section pass-reassurance-section">
        <div className="container">
          <h2 className="section-title">Ce qui sécurise votre inscription</h2>
          <div className="grid-4 reassurance-grid">
            {reassuranceItems.map(([title, text]) => (
              <article className="reassurance-item" key={title}>
                <ShieldCheck size={26} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <p className="center" style={{ marginTop: 34 }}>
            <Link className="btn btn-gold" href="/formations?checkout=annual-pass">
              Obtenir le pass annuel <ArrowRight size={17} />
            </Link>
          </p>
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
