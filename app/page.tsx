import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ArrowRight, ExternalLink, Newspaper } from "lucide-react";
import { getCourses } from "@/lib/server-data";
import { siteDescription } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "Institut d'Apologétique Saint Irénée"
  },
  description: siteDescription,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Institut d'Apologétique Saint Irénée",
    description: siteDescription,
    url: "/"
  }
};

const features = [
  {
    title: "L'EIDM devient l'Institut Saint Irénée",
    text: "L'élan de l'EIDM se poursuit dans un institut structuré pour former, accompagner et transmettre la foi catholique avec clarté.",
    image: "/images/eidm-institut-saint-irenee.png",
    imagePosition: "50% 42%",
    icon: "/images/irenee-feature-medallion-teacher.png",
    iconLeft: "50%",
    iconPosition: "50% 50%",
    href: "/institut-apologetique"
  },
  {
    title: "Bibliothèque d'école apologétique",
    text: "Une bibliothèque réservée aux étudiants pour demander le livre apologétique de leur choix après une adhésion annuelle de 15 EUR.",
    image: "/images/irenee-feature-1.png",
    imagePosition: "50% 50%",
    icon: "/images/irenee-feature-medallion-library.png",
    iconLeft: "50%",
    iconPosition: "50% 50%",
    href: "/bibliotheque-apologetique"
  },
  {
    title: "Formation en direct chaque semaine",
    text: "Un soir par semaine, les étudiants retrouvent une séance en visio depuis le site pour travailler, questionner et progresser ensemble.",
    image: "/images/irenee-feature-3.png",
    imagePosition: "50% 50%",
    icon: "/images/irenee-feature-medallion-3.png",
    iconLeft: "50%",
    iconPosition: "50% 50%",
    href: "/formations"
  },
  {
    title: "Sessions patristiques en abbaye",
    text: "Des sessions de 5 jours autour d'un thème différent, des conciles et des Pères de l'Église, pour étudier avec un expert.",
    image: "/images/cloitre-sessions-patristiques.png",
    imagePosition: "50% 50%",
    icon: "/images/irenee-feature-medallion-abbey.png",
    iconLeft: "50%",
    iconPosition: "50% 50%",
    href: "/contact"
  }
];

export default async function HomePage() {
  const courses = await getCourses();

  return (
    <>
      <section className="hero-band home-hero">
        <div className="container">
          <div className="hero-content">
            <span className="hero-eyebrow">Rentrée académique 2026 · inscriptions ouvertes</span>
            <h1 className="font-display hero-title">
              <span className="hero-title-desktop">Institut d'Apologétique<br /><span>Saint Irénée</span></span>
              <span className="hero-title-mobile">Institut<br />d'Apologétique<br /><span>Saint Irénée</span></span>
            </h1>
            <p className="hero-motto">
              <span className="hero-motto-desktop">Rendre compte de la crédibilité de la foi catholique</span>
              <span className="hero-motto-mobile">Rendre compte de la crédibilité<br />de la foi catholique</span>
            </p>
            <div className="hero-separator" aria-hidden="true" />
            <p className="hero-lead">
              Approfondissez votre foi catholique et apprenez à la défendre avec rigueur et bienveillance grâce à nos formations en ligne dispensées par des experts catholiques.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/formations">
                Découvrir les formations <ArrowRight size={18} />
              </Link>
              <Link className="btn btn-outline" href="/contact">
                Nous contacter
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="home-feature-section">
        <div className="container">
          <div className="home-feature-grid">
            {features.map((feature) => (
              <article
                className="card feature-card"
                key={feature.title}
                style={{
                  "--card-image": `url(${feature.image})`,
                  "--card-image-position": feature.imagePosition,
                  "--feature-icon-left": feature.iconLeft
                } as CSSProperties}
              >
                <span className="feature-icon">
                  <Image src={feature.icon} alt="" fill sizes="72px" style={{ objectFit: "cover", objectPosition: feature.iconPosition }} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
                <Link className="feature-link" href={feature.href}>
                  En savoir plus <ArrowRight size={14} />
                </Link>
              </article>
            ))}
          </div>
          <div className="quote-banner">
            <blockquote>
              "Soyez toujours prêts à rendre compte de l'espérance qui est en vous."
              <cite>1 Pierre 3,15</cite>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="section home-press-section">
        <div className="container">
          <article className="press-home-card">
            <div className="press-home-image">
              <Image
                src="/images/presse-liberation-institut-saint-irenee.png"
                alt="Revue de presse de l'Institut Saint Irénée"
                fill
                sizes="(max-width: 900px) 100vw, 42vw"
              />
            </div>
            <div className="press-home-content">
              <span className="hero-eyebrow"><Newspaper size={16} /> Dans la presse nationale</span>
              <h2 className="font-display">Libération parle de l'Institut Saint Irénée</h2>
              <p>
                Un article publié le 17 juin 2026 met l'Institut Saint Irénée au cœur du débat sur
                l'apologétique catholique, la formation chrétienne et la place du catholicisme dans l'espace public.
              </p>
              <div className="press-home-actions">
                <Link className="btn btn-gold" href="/presse/liberation-institut-saint-irenee-2026">
                  Lire notre résumé <ArrowRight size={17} />
                </Link>
                <a className="btn btn-outline" href="https://www.liberation.fr/societe/religions/avec-linstitut-saint-irenee-le-catholicisme-identitaire-se-met-en-ordre-de-bataille-20260617_64O26CD53FD5DOSYZZBIKXWRUA/" target="_blank" rel="noreferrer">
                  Article original <ExternalLink size={17} />
                </a>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="container center">
          <span className="hero-eyebrow">Comprendre, répondre, transmettre</span>
          <h2 className="section-title">Un institut d'apologétique catholique accessible en ligne</h2>
          <p className="subtitle" style={{ maxWidth: 930, margin: "0 auto 26px" }}>
            L'Institut Irénée propose une formation structurée pour apprendre à présenter les raisons de croire,
            étudier les sources et répondre aux objections contemporaines. L'objectif n'est pas de gagner des
            querelles, mais de servir la vérité avec précision, patience et charité.
          </p>
          <Link className="btn btn-outline" href="/institut-apologetique">
            Découvrir l'Institut d'Apologétique <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="container center">
          <h2 className="section-title">Notre mission : former les <span style={{ color: "var(--gold-2)" }}>apologètes de demain</span></h2>
          <p className="subtitle" style={{ maxWidth: 820, margin: "0 auto 42px" }}>
            L'Institut Irénée accompagne les jeunes adultes dans l'approfondissement de leur foi catholique et les forme à en rendre compte avec intelligence, précision et charité.
          </p>
          <div className="grid-3" style={{ textAlign: "left" }}>
            {[
              ["Rigueur doctrinale", "Des contenus enracinés dans l'Écriture, la Tradition apostolique et le Magistère de l'Église."],
              ["Pédagogie accessible", "Des modules progressifs, conçus pour apprendre à argumenter sans perdre le sens pastoral."],
              ["Vie spirituelle", "Une formation intellectuelle orientée vers la sainteté, le témoignage et la mission."]
            ].map(([title, text]) => (
              <article className="soft-card" key={title} style={{ padding: 30 }}>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container center">
          <h2 className="section-title">Nos formations</h2>
          <p className="subtitle">Un parcours structuré en deux semestres pour une formation complète en apologétique.</p>
          <div className="grid-2" style={{ marginTop: 40, textAlign: "left" }}>
            {courses.slice(0, 2).map(course => (
              <article className="card" key={course.id} style={{ padding: 30 }}>
                <span className="badge">{course.niveau}</span>
                <h3 style={{ color: "#fff7e7", fontSize: "1.7rem" }}>{course.titre}</h3>
                <p className="muted">{course.description}</p>
                <Link className="btn btn-outline" href={`/cours/${course.slug}`}>Voir le cours <ArrowRight size={16} /></Link>
              </article>
            ))}
            {!courses.length && <p>Aucune formation disponible pour le moment.</p>}
          </div>
          <Link href="/formations" className="btn btn-gold" style={{ marginTop: 36 }}>
            Découvrir toutes les formations <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <section className="section home-partners">
        <div className="container center">
          <h2 className="section-title">Nos Partenaires</h2>
          <div className="grid-4" style={{ marginTop: 36 }}>
            {[
              ["Heaven Radio", "100% Louange et Adoration", "https://lebaptemecatholique.fr/assets/heavenradio.png", "https://heavenradio.fr/"],
              ["La Mission Catholique", "Évangélisation et mission", "https://lebaptemecatholique.fr/assets/missioncatho.png", "https://lamissioncatholique.fr/"],
              ["Ultreia Event", "Événements catholiques", "/images/ultreia.png", "https://ultreiaevent.com/"],
              ["SOS Chrétiens d'Occident", "Aide aux chrétiens persécutés", "/images/soscatho.png", "https://soschretiensdoccident.fr/"]
            ].map(([name, desc, src, href]) => (
              <a className="partner-card soft-card" key={name} href={href} target="_blank" rel="noreferrer">
                <Image src={src} alt={name} width={180} height={92} style={{ objectFit: "contain", maxWidth: "100%" }} />
                <h3>{name} <ExternalLink size={18} aria-hidden="true" /></h3>
                <p className="muted">{desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section hero-band center">
        <div className="container">
          <h2 className="font-display" style={{ fontSize: "2.7rem", margin: 0 }}>Prêt à approfondir votre foi ?</h2>
          <p style={{ color: "#f0dfc2" }}>Rejoignez notre prochaine promotion et découvrez les richesses de l'apologétique catholique.</p>
          <Link href="/auth/signup" className="btn btn-gold">S'inscrire maintenant <ArrowRight size={18} /></Link>
        </div>
      </section>
    </>
  );
}
