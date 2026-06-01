import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  const isLibraryMembership = product === "library-membership";

  return (
    <section className="section" style={{ minHeight: 620 }}>
      <div className="container center">
        <div className="card" style={{ padding: 42, maxWidth: 740, margin: "0 auto" }}>
          <CheckCircle2 size={48} color="#22c55e" />
          <h1 className="title" style={{ marginTop: 18 }}>Paiement confirmé</h1>
          <p className="subtitle">
            {isLibraryMembership
              ? "PayPal a confirmé le paiement. Votre adhésion à la bibliothèque est active : vous pouvez maintenant demander le livre de votre choix depuis votre espace étudiant."
              : "PayPal a confirmé le paiement. Votre pass annuel est actif et l'ensemble du cursus apparaît dans votre espace étudiant."}
          </p>
          <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/espace-etudiant">Ouvrir mon espace étudiant</Link>
            <Link className="btn btn-outline" href="/formations">Voir les formations</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
