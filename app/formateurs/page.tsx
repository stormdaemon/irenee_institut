import Image from "next/image";
import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { formatDbAvatar, getTrainers } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formateurs en apologétique catholique",
  description:
    "Découvrez les formateurs de l'Institut Irénée et leur travail de transmission de la foi catholique avec rigueur intellectuelle et pédagogie.",
  alternates: {
    canonical: "/formateurs"
  }
};

export default async function FormateursPage() {
  const trainers = await getTrainers();

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1 className="font-display" style={{ fontSize: "4rem", margin: 0 }}>Nos Formateurs</h1>
          <p style={{ fontSize: "1.3rem", color: "#dce6f6", maxWidth: 760 }}>
            Une équipe d'experts passionnés, alliant rigueur académique et pédagogie accessible.
          </p>
        </div>
      </section>
      <section className="section" style={{ background: "white" }}>
        <div className="container center">
          <h2 className="section-title">Excellence & Passion au service de la formation</h2>
          <p className="subtitle" style={{ maxWidth: 850, margin: "0 auto 60px" }}>
            Nos formateurs sont des experts reconnus dans leurs domaines respectifs : théologie catholique,
            philosophie, histoire de l'Église, apologétique.
          </p>
          <div className="grid-2" style={{ textAlign: "left" }}>
            {trainers.map(trainer => (
              <article className="card" key={trainer.id} style={{ padding: 28 }}>
                <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
                  <Image
                    src={formatDbAvatar(trainer) || "/images/balzaac.jpeg"}
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
