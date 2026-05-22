import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function PaymentSuccessPage() {
  return (
    <section className="section" style={{ minHeight: 620 }}>
      <div className="container center">
        <div className="card" style={{ padding: 42, maxWidth: 740, margin: "0 auto" }}>
          <CheckCircle2 size={48} color="#22c55e" />
          <h1 className="title" style={{ marginTop: 18 }}>Paiement en cours de confirmation</h1>
          <p className="subtitle">
            Votre achat est en cours de confirmation. La formation apparaîtra dans votre espace étudiant dès que le paiement sera validé.
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
