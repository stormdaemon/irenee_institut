import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, CheckCircle2, Library, ShieldCheck } from "lucide-react";
import { LibraryMembershipButton } from "@/components/LibraryMembershipButton";

export const metadata: Metadata = {
  title: "Bibliothèque d'école apologétique",
  description:
    "Adhérez à la bibliothèque d'école apologétique de l'Institut d'Apologétique Saint Irénée et demandez le livre de votre choix depuis votre espace étudiant.",
  alternates: {
    canonical: "/bibliotheque-apologetique"
  }
};

export default function LibraryPage() {
  return (
    <>
      <section className="page-hero library-hero">
        <div className="container library-hero-grid">
          <div>
            <span className="hero-eyebrow">Un service réservé aux étudiants</span>
            <h1 className="font-display">Bibliothèque d'école apologétique</h1>
            <p>
              Constituez votre parcours de lecture avec l'Institut d'Apologétique Saint Irénée.
              L'adhésion annuelle ouvre la possibilité de demander le livre apologétique de votre choix.
            </p>
            <div className="hero-actions">
              <LibraryMembershipButton />
              <Link className="btn btn-outline" href="/espace-etudiant">Ouvrir mon espace etudiant</Link>
            </div>
          </div>
          <div className="library-hero-medallion">
            <Image src="/images/irenee-feature-medallion-library.png" alt="" fill sizes="280px" priority />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Comment fonctionne la bibliothèque ?</h2>
          <p className="subtitle center" style={{ maxWidth: 820, margin: "0 auto 38px" }}>
            Le paiement est rattaché à votre compte étudiant. Dès sa confirmation, un nouvel espace apparaît dans votre tableau de bord.
          </p>
          <div className="grid-3">
            <article className="soft-card library-step">
              <ShieldCheck size={34} />
              <h3>1. Compte etudiant</h3>
              <p className="muted">Connectez-vous ou créez votre compte pour rattacher l'adhésion à votre espace personnel.</p>
            </article>
            <article className="soft-card library-step">
              <Library size={34} />
              <h3>2. Adhésion à 15 EUR</h3>
              <p className="muted">Réglez l'adhésion annuelle par paiement sécurisé. Le tarif est fixe et clairement affiché avant validation.</p>
            </article>
            <article className="soft-card library-step">
              <BookOpen size={34} />
              <h3>3. Demande de livre</h3>
              <p className="muted">Depuis votre espace étudiant, saisissez le titre souhaité et suivez l'état de votre demande.</p>
            </article>
          </div>
          <div className="soft-card library-note">
            <CheckCircle2 size={22} />
            <p>Votre demande est transmise à la direction pour validation et organisation de la mise à disposition.</p>
          </div>
        </div>
      </section>
    </>
  );
}
