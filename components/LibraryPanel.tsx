"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Clock3, Library, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import type { BookRequest, LibraryMembership } from "@/lib/types";

function statusLabel(status: BookRequest["status"]) {
  if (status === "approuve") return "Approuvée";
  if (status === "refuse") return "Refusée";
  return "En attente de la direction";
}

function StatusIcon({ status }: { status: BookRequest["status"] }) {
  if (status === "approuve") return <CheckCircle2 size={17} color="#22c55e" />;
  if (status === "refuse") return <XCircle size={17} color="#ef4444" />;
  return <Clock3 size={17} color="#eab308" />;
}

export function LibraryPanel({
  initialRequests,
  membership
}: {
  initialRequests: BookRequest[];
  membership?: LibraryMembership | null;
}) {
  const [bookTitle, setBookTitle] = useState("");
  const [requests, setRequests] = useState(initialRequests);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    const supabase = createBrowserClient();
    const { data } = await supabase?.auth.getSession() || { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) {
      setError("Reconnectez-vous avant d'envoyer votre demande.");
      setStatus("error");
      return;
    }

    const response = await fetch("/api/library/book-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ requestedTitle: bookTitle })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "Votre demande n'a pas pu être transmise.");
      setStatus("error");
      return;
    }

    setRequests(current => [payload.data, ...current]);
    setBookTitle("");
    setStatus("idle");
  }

  if (!membership) {
    return (
      <div className="card library-dashboard-card">
        <Library size={28} color="var(--gold-2)" />
        <div>
          <h2 className="font-display">Bibliothèque d'école apologétique</h2>
          <p className="muted">Adhérez pour 15 EUR par an afin de demander le livre apologétique de votre choix.</p>
          <Link className="btn btn-gold" href="/bibliotheque-apologetique">Découvrir la bibliothèque</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card library-dashboard-card">
      <div className="library-dashboard-head">
        <div>
          <span className="badge"><Library size={15} /> Adhésion active</span>
          <h2 className="font-display">Ma bibliothèque apologétique</h2>
          <p className="muted">Accès actif jusqu'au {new Date(membership.expires_at).toLocaleDateString("fr-FR")}.</p>
        </div>
        <BookOpen size={34} color="var(--gold-2)" />
      </div>
      <form className="library-request-form" onSubmit={submit}>
        <label>
          <span>Livre souhaité</span>
          <input
            className="input"
            maxLength={180}
            placeholder="Ex : Le Dieu un et trine"
            required
            value={bookTitle}
            onChange={event => setBookTitle(event.target.value)}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={status === "saving"}>
          {status === "saving" ? <Loader2 className="action-spin" size={17} /> : <BookOpen size={17} />}
          Envoyer ma demande
        </button>
      </form>
      {error && <small className="field-error" role="alert">{error}</small>}
      {requests.length > 0 && (
        <div className="library-request-list">
          <h3>Mes demandes</h3>
          {requests.slice(0, 6).map(request => (
            <div className="library-request-item" key={request.id}>
              <StatusIcon status={request.status} />
              <span><strong>{request.requested_title}</strong><small>{statusLabel(request.status)}</small></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
