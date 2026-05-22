"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { formatPrice } from "@/lib/data";
import { ActionNotice } from "@/components/ActionNotice";

function formationLabel(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "Non renseignée");
}

export function PaymentsClient({ initialRequests }: { initialRequests: Profile[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function validate(id: string) {
    setStatus("saving");
    setError("");
    const response = await fetch(`/api/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "validee" })
    });
    const data = await response.json();
    if (response.ok && data.verified === true) {
      setRequests(current => current.map(item => item.id === id ? { ...item, statut_inscription: "validee" } : item));
      setStatus("success");
    } else {
      setError(data.error || "Le paiement n'a pas pu être confirmé.");
      setStatus("error");
    }
  }

  return (
    <>
      <ActionNotice status={status} success="Paiement validé." error={error} />
      <div className="card table-wrap">
        <table className="data-table">
          <thead><tr><th>Inscrit</th><th>Formation</th><th>Tarif</th><th>Paiement</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {requests.map(item => (
              <tr key={item.id}>
                <td><strong>{item.prenom} {item.nom}</strong><br /><small>{item.email}</small></td>
                <td>{formationLabel(item.formation_choisie)}</td>
                <td>{item.tarif_applicable || "standard"}</td>
                <td>{item.modalite_paiement || "1x"} · {item.moyen_paiement || "à traiter"}</td>
                <td>{formatPrice(item.tarif_applicable === "reduit" ? 3920 : 4900)}</td>
                <td><span className="badge">{item.statut_inscription || "en_attente"}</span></td>
                <td><button className="btn btn-primary" disabled={item.statut_inscription === "validee"} onClick={() => validate(item.id)}>Valider</button></td>
              </tr>
            ))}
            {!requests.length && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: "center" }}>Aucune demande d'inscription enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
