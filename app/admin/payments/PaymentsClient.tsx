"use client";

import { useState } from "react";
import { ActionNotice } from "@/components/ActionNotice";
import { formatPrice } from "@/lib/data";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import type { BookRequest, Profile } from "@/lib/types";

function formationLabel(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "Non renseignee");
}

function bookStatusLabel(status: BookRequest["status"]) {
  if (status === "approuve") return "Approuve";
  if (status === "refuse") return "Refuse";
  return "En attente direction";
}

export function PaymentsClient({
  initialBookRequests,
  initialRequests
}: {
  initialBookRequests: BookRequest[];
  initialRequests: Profile[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [bookRequests, setBookRequests] = useState(initialBookRequests);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function validate(id: string) {
    setStatus("saving");
    setError("");
    const response = await authenticatedFetch(`/api/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "validee" })
    });
    const data = await response.json();
    if (response.ok && data.verified === true) {
      setRequests(current => current.map(item => item.id === id ? { ...item, statut_inscription: "validee" } : item));
      setStatus("success");
    } else {
      setError(data.error || "Le paiement n'a pas pu etre confirme.");
      setStatus("error");
    }
  }

  async function updateBookRequest(id: string, nextStatus: BookRequest["status"]) {
    setStatus("saving");
    setError("");
    const response = await authenticatedFetch(`/api/book-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok) {
      setBookRequests(current => current.map(item => item.id === id ? { ...item, status: nextStatus, reviewed_at: new Date().toISOString() } : item));
      setStatus("success");
    } else {
      setError(data?.error || "La demande de livre n'a pas pu etre mise a jour.");
      setStatus("error");
    }
  }

  return (
    <>
      <ActionNotice status={status} success="Mise a jour enregistree." error={error} />
      <div className="card table-wrap">
        <table className="data-table">
          <thead><tr><th>Inscrit</th><th>Formation</th><th>Tarif</th><th>Paiement</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {requests.map(item => (
              <tr key={item.id}>
                <td><strong>{item.prenom} {item.nom}</strong><br /><small>{item.email}</small></td>
                <td>{formationLabel(item.formation_choisie)}</td>
                <td>{item.tarif_applicable || "standard"}</td>
                <td>{item.modalite_paiement || "paiement libre"} - {item.moyen_paiement || "paypal"}</td>
                <td>{formatPrice(9900)}</td>
                <td><span className="badge">{item.statut_inscription || "en_attente"}</span></td>
                <td><button className="btn btn-primary" disabled={item.statut_inscription === "validee"} onClick={() => validate(item.id)}>Valider</button></td>
              </tr>
            ))}
            {!requests.length && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: "center" }}>Aucune demande d'inscription enregistree.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 38 }}>Demandes de livre d'apologetique</h2>
      <div className="card table-wrap">
        <table className="data-table">
          <thead><tr><th>Etudiant</th><th>Formation</th><th>Livre souhaite</th><th>Commande PayPal</th><th>Statut</th><th>Actions direction</th></tr></thead>
          <tbody>
            {bookRequests.map(item => (
              <tr key={item.id}>
                <td><strong>{item.profiles?.prenom} {item.profiles?.nom}</strong><br /><small>{item.profiles?.email}</small></td>
                <td>{item.courses?.titre || (item.library_membership_id ? "Bibliothèque d'école apologétique" : item.course_id || "Service étudiant")}</td>
                <td><strong>{item.requested_title || "Titre non renseigne"}</strong></td>
                <td>{item.paypal_order_id || "Non renseignee"}</td>
                <td><span className="badge">{bookStatusLabel(item.status)}</span></td>
                <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-primary" disabled={item.status === "approuve"} onClick={() => updateBookRequest(item.id, "approuve")}>Approuver</button>
                  <button className="btn btn-outline" disabled={item.status === "refuse"} onClick={() => updateBookRequest(item.id, "refuse")}>Refuser</button>
                </td>
              </tr>
            ))}
            {!bookRequests.length && (
              <tr><td colSpan={6} style={{ padding: 30, textAlign: "center" }}>Aucune demande de livre en attente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
