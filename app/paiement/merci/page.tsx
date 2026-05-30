import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function PaymentSuccessPage() {
  return (
    <section className="section" style={{ minHeight: 620 }}>
      <div className="container center">
        <div className="card" style={{ padding: 42, maxWidth: 740, margin: "0 auto" }}>
          <CheckCircle2 size={48} color="#22c55e" />
          <h1 className="title" style={{ marginTop: 18 }}>Paiement confirme</h1>
          <p className="subtitle">
            PayPal a confirme le paiement. Votre formation est attribuee automatiquement et apparait dans votre espace etudiant.
            Si vous avez demande le livre d&apos;apologetique, la direction validera cette demande separement.
          </p>
          <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/espace-etudiant">Ouvrir mon espace etudiant</Link>
            <Link className="btn btn-outline" href="/formations">Voir les formations</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
