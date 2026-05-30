import { CheckCircle2, CreditCard, XCircle } from "lucide-react";
import { getBookRequests, getPaymentRequests } from "@/lib/server-data";
import { PaymentsClient } from "./PaymentsClient";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const [requests, bookRequests] = await Promise.all([getPaymentRequests(), getBookRequests()]);

  return (
    <section className="section">
      <div className="container">
        <a href="/admin">← Retour au tableau de bord</a>
        <h1 className="title" style={{ marginTop: 28 }}>Paiements</h1>
        <p className="subtitle">Valider les demandes d'inscription</p>
        <div className="grid-3" style={{ margin: "32px 0" }}>
          <div className="soft-card" style={{ padding: 24 }}><CreditCard /> <strong>{requests.length}</strong><p>Demandes</p></div>
          <div className="soft-card" style={{ padding: 24 }}><CheckCircle2 color="#22c55e" /> <strong>{requests.filter(item => item.statut_inscription === "validee").length}</strong><p>Validées</p></div>
          <div className="soft-card" style={{ padding: 24 }}><XCircle color="#eab308" /> <strong>{requests.filter(item => item.statut_inscription !== "validee").length}</strong><p>En attente</p></div>
        </div>
        <PaymentsClient initialRequests={requests} initialBookRequests={bookRequests} />
      </div>
    </section>
  );
}
