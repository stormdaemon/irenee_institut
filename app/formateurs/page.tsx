import Image from "next/image";
import type { Metadata } from "next";
import { ExternalLink, Mail } from "lucide-react";
import { formatDbAvatar, getTrainers } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Équipe de l'Institut d'Apologétique Saint Irénée",
  description:
    "Découvrez la direction et les formateurs de l'Institut d'Apologétique Saint Irénée au service d'une transmission catholique rigoureuse et accessible.",
  alternates: {
    canonical: "/formateurs"
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
          <div className="grid-2 about-directors">
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
                <Image src="/images/abbe-de-tanouarn.jpg" alt="Abbé Guillaume de Tanoüarn" fill sizes="150px" style={{ objectFit: "cover", objectPosition: "55% 28%" }} />
              </div>
              <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span className="badge">Directeur administratif</span>
                <span className="badge">Institut du bon pasteur</span>
              </div>
              <h3>Abbé de Tanoüarn</h3>
              <p className="muted">Directeur administratif, engagé dans l'organisation et l'accompagnement des étudiants.</p>
              <small className="muted">
                Photo : <a href="https://commons.wikimedia.org/wiki/File:Paris_-_Abb%C3%A9_Guillaume_de_Tano%C3%BCarn_-_3.jpg" target="_blank" rel="noreferrer">Peter Potrowl, CC BY-SA 4.0</a>
              </small>
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
