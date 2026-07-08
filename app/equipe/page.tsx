import Image from "next/image";
import type { Metadata } from "next";
import { ExternalLink, Mail } from "lucide-react";
import { formatDbAvatar, getTrainers } from "@/lib/server-data";

export const dynamic = "force-dynamic";

type TeamMember = {
  achievements: string[];
  description: string;
  email?: string;
  image: string;
  imagePosition?: string;
  name: string;
  source?: {
    href: string;
    label: string;
  };
  tags: string[];
  title: string;
};

const staticTeamMembers: TeamMember[] = [
  {
    achievements: [
      "Module parcours biblique",
      "Accompagnement biblique du cursus",
      "Lecture théologique et pastorale des Écritures"
    ],
    description:
      "En plus de sa mission de directeur des études, Frère Jean Emmanuel intervient comme bibliste pour accompagner le module de parcours biblique et aider les étudiants à entrer dans l'intelligence des Écritures.",
    image: "/images/frere-jean-emmanuel-de-ena.png",
    imagePosition: "50% 50%",
    name: "Frère Jean Emmanuel",
    tags: ["Bible", "Écritures", "Parcours biblique", "Exégèse"],
    title: "Module parcours biblique"
  },
  {
    achievements: [
      "Module convaincre, argumenter et rhétorique",
      "Pratique de l'argumentation publique",
      "Approche juridique et méthodique du débat"
    ],
    description:
      "Avocat à la cour de Paris, Maître Frédéric Pichon accompagne l'institut sur les méthodes d'argumentation, la rigueur rhétorique et l'art de convaincre avec clarté.",
    image: "/images/frederic-pichon.jpg",
    imagePosition: "50% 22%",
    name: "Maître Frédéric Pichon",
    source: {
      href: "https://www.avocat-pichon.com/",
      label: "Site du cabinet"
    },
    tags: ["Argumentation", "Rhétorique", "Convaincre", "Droit"],
    title: "Module convaincre et argumenter"
  },
  {
    achievements: [
      "Module islam et monde arabe",
      "Fondateur de la revue Le Monde Copte",
      "Travaux en égyptologie et coptologie"
    ],
    description:
      "Égyptologue, coptologue et fondateur de la revue Le Monde Copte, Ashraf Saddaq intervient sur les rapports entre islam, monde arabe et cultures chrétiennes orientales.",
    image: "/images/ashraf-sadek.jpg",
    imagePosition: "20% 52%",
    name: "Ashraf Saddaq",
    source: {
      href: "https://www.lemondecopte.com/",
      label: "Le Monde Copte"
    },
    tags: ["Islam", "Monde arabe", "Égypte", "Culture copte"],
    title: "Module islam et monde arabe"
  },
  {
    achievements: [
      "Module christologie",
      "Travaux de théologie et de transmission",
      "Auteur d'ouvrages de formation chrétienne"
    ],
    description:
      "Françoise Breynaert apporte son expertise théologique au module de christologie, avec une attention particulière à l'intelligence de la foi et à la pédagogie doctrinale.",
    image: "/images/francoise-breynaert.jpg",
    imagePosition: "50% 35%",
    name: "Françoise Breynaert",
    source: {
      href: "https://www.foi-vivifiante.fr/",
      label: "Foi vivifiante"
    },
    tags: ["Christologie", "Théologie", "Transmission"],
    title: "Module christologie"
  },
  {
    achievements: [
      "Module histoire de l'Église",
      "Agrégé d'histoire",
      "Travaux sur l'histoire religieuse du Var et de la Provence"
    ],
    description:
      "Agrégé d'histoire, Alain Vignal apporte son expertise au module d'histoire de l'Église, avec une attention particulière aux sources, aux faits et aux grandes évolutions du christianisme.",
    image: "/images/alain-vignal.jpg",
    imagePosition: "50% 42%",
    name: "Alain Vignal",
    source: {
      href: "https://www.capsud-mediterranee.fr/alain-vignal",
      label: "Profil Cap Sud Méditerranée"
    },
    tags: ["Histoire de l'Église", "Christianisme", "Histoire religieuse"],
    title: "Module histoire de l'Église"
  }
];

export const metadata: Metadata = {
  title: "Équipe de l'Institut d'Apologétique Saint Irénée",
  description:
    "Découvrez la direction et les formateurs de l'Institut d'Apologétique Saint Irénée au service d'une transmission catholique rigoureuse et accessible.",
  alternates: {
    canonical: "/equipe"
  }
};

export default async function FormateursPage() {
  const trainers = await getTrainers();
  const samuelPhotoUrl = "https://bilan-previsionnel.fr/wp-content/uploads/2020/11/Bilan-Previsionnel-presentation-portrait-img-1.jpg";
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1 className="font-display" style={{ fontSize: "4rem", margin: 0 }}>Notre équipe</h1>
          <p style={{ fontSize: "1.3rem", color: "#dce6f6", maxWidth: 760 }}>
            Une direction engagée et des experts passionnés, alliant rigueur académique et pédagogie accessible.
          </p>
        </div>
      </section>
      <section className="section about-direction-section">
        <div className="container center">
          <h2 className="section-title">Direction</h2>
          <div className="about-directors">
            <article className="card about-director-card">
              <div className="about-director-photo">
                <Image src={samuelPhotoUrl} alt="Samuel Armanios" fill sizes="150px" style={{ objectFit: "cover", objectPosition: "52% 14%", transform: "scale(1.62)" }} />
              </div>
              <span className="badge">Directeur</span>
              <h3>Samuel Armanios</h3>
              <p className="muted">Diplômé en théologie à l'Université de la Sainte-Croix.</p>
            </article>
            <article className="card about-director-card">
              <div className="about-director-photo">
                <Image src="/images/theo-lafont.jpg" alt="Théo Lafont" fill sizes="150px" style={{ objectFit: "cover", objectPosition: "50% 18%" }} />
              </div>
              <span className="badge">Directeur du développement</span>
              <h3>Théo Lafont</h3>
              <p className="muted">Assure le suivi opérationnel des inscriptions et le développement complet de la plateforme de l'institut.</p>
            </article>
            <article className="card about-director-card">
              <div className="about-director-photo">
                <Image src="/images/frere-jean-emmanuel-de-ena.png" alt="Frère Jean Emmanuel" fill sizes="150px" style={{ objectFit: "cover", objectPosition: "50% 50%" }} />
              </div>
              <span className="badge">Directeur des études</span>
              <h3>Frère Jean Emmanuel</h3>
              <p className="muted">Accompagne l'exigence académique et spirituelle du parcours d'apologétique.</p>
            </article>
          </div>
        </div>
      </section>
      <section className="section" style={{ background: "white" }}>
        <div className="container center">
          <h2 className="section-title">Formateurs et directeurs d'études</h2>
          <p className="subtitle" style={{ maxWidth: 850, margin: "0 auto 60px" }}>
            Nos formateurs sont des experts reconnus dans leurs domaines respectifs : théologie catholique,
            philosophie, histoire de l'Église, apologétique.
          </p>
          <div className="grid-2" style={{ textAlign: "left" }}>
            {trainers.map(trainer => (
              <article className="card" key={trainer.id} style={{ padding: 28 }}>
                <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
                  <Image
                    src={formatDbAvatar(trainer) || "/images/guillaume-maspero.jpg"}
                    alt={`${trainer.prenom} ${trainer.nom}`}
                    width={96}
                    height={96}
                    style={{ borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div>
                    <h2 className="font-display" style={{ color: "var(--navy)", margin: 0 }}>{trainer.prenom} {trainer.nom}</h2>
                    <strong style={{ color: "#b28a0d" }}>{trainer.profession || "Formateur"}</strong>
                    <p><Mail size={18} color="var(--navy)" /> {trainer.email}</p>
                  </div>
                </div>
                <p>{(trainer.specialites || []).map(tag => <span className="badge" key={tag} style={{ marginRight: 8, marginTop: 14 }}>{tag}</span>)}</p>
                <p className="muted" style={{ lineHeight: 1.7 }}>{trainer.bio_description || trainer.bio}</p>
                {trainer.nom === "Maspero" && (
                  <p><a className="feature-link" href="https://www.pusc.it/teo/docenti/maspero" target="_blank" rel="noreferrer">Voir le profil académique officiel <ExternalLink size={14} /></a></p>
                )}
                <h3>Réalisations</h3>
                <ul>{(trainer.realisations || []).map(item => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
            {staticTeamMembers.map(member => (
              <article className="card" key={member.name} style={{ padding: 28 }}>
                <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
                  <Image
                    src={member.image}
                    alt={member.name}
                    width={96}
                    height={96}
                    style={{ borderRadius: "50%", objectFit: "cover", objectPosition: member.imagePosition || "50% 50%" }}
                  />
                  <div>
                    <h2 className="font-display" style={{ color: "var(--navy)", margin: 0 }}>{member.name}</h2>
                    <strong style={{ color: "#b28a0d" }}>{member.title}</strong>
                    {member.email && <p><Mail size={18} color="var(--navy)" /> {member.email}</p>}
                  </div>
                </div>
                <p>{member.tags.map(tag => <span className="badge" key={tag} style={{ marginRight: 8, marginTop: 14 }}>{tag}</span>)}</p>
                <p className="muted" style={{ lineHeight: 1.7 }}>{member.description}</p>
                {member.source && (
                  <p><a className="feature-link" href={member.source.href} target="_blank" rel="noreferrer">{member.source.label} <ExternalLink size={14} /></a></p>
                )}
                <h3>Réalisations</h3>
                <ul>{member.achievements.map(item => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
          <div className="soft-card" style={{ maxWidth: 760, margin: "60px auto 0", padding: 28 }}>
            <h2 className="font-display" style={{ color: "var(--navy)" }}>Notre équipe s'agrandit</h2>
            <p>D'autres formateurs experts rejoindront prochainement notre institut pour enrichir notre offre de formation.</p>
          </div>
        </div>
      </section>
    </>
  );
}
