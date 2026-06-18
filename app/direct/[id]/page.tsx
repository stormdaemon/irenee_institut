"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

type LiveRoom = {
  id: string;
  titre: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  room_url: string;
};

export default function DirectSessionPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unauthenticated" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    async function loadRoom() {
      try {
        const response = await authenticatedFetch(`/api/live/${id}`);
        const data = await response.json().catch(() => null);
        if (!mounted) return;

        if (!response.ok || data?.ok !== true) {
          setError(data?.error || "La séance n'a pas pu être chargée.");
          setStatus(response.status === 401 ? "unauthenticated" : "error");
          return;
        }

        setRoom(data.session);
        setStatus("ready");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Connectez-vous pour rejoindre la séance.");
        setStatus("unauthenticated");
      }
    }

    loadRoom();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <section className="section" style={{ minHeight: 620 }}>
        <div className="container center">
          <div className="card" style={{ padding: 42, maxWidth: 620, margin: "0 auto" }}>
            <Loader2 className="action-spin" size={34} />
            <h1 className="title" style={{ marginTop: 18 }}>Connexion à la séance</h1>
            <p className="subtitle">Préparation de la salle en direct...</p>
          </div>
        </div>
      </section>
    );
  }

  if (status !== "ready" || !room) {
    return (
      <section className="section" style={{ minHeight: 620 }}>
        <div className="container center">
          <div className="card" style={{ padding: 42, maxWidth: 680, margin: "0 auto" }}>
            <AlertTriangle size={38} color="var(--gold-2)" />
            <h1 className="title" style={{ marginTop: 18 }}>{status === "unauthenticated" ? "Connexion requise" : "Séance indisponible"}</h1>
            <p className="subtitle">{error}</p>
            <Link href={status === "unauthenticated" ? `/auth/login?next=/direct/${id}` : "/espace-etudiant"} className="btn btn-primary">
              {status === "unauthenticated" ? "Se connecter" : "Retour à l'espace étudiant"}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <span className="badge">Séance en direct</span>
            <h1 className="title" style={{ marginTop: 10 }}>{room.titre}</h1>
            {room.description && <p className="subtitle" style={{ margin: 0 }}>{room.description}</p>}
          </div>
          <Link href="/espace-etudiant" className="btn btn-outline"><ArrowLeft size={18} /> Mon espace</Link>
        </div>

        <div className="card" style={{ padding: 8, overflow: "hidden" }}>
          <iframe
            title={room.titre}
            src={room.room_url}
            allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
            style={{ width: "100%", height: "min(74vh, 720px)", border: "0", borderRadius: 12, display: "block" }}
          />
        </div>
        <p className="muted" style={{ marginTop: 14 }}>
          La salle est sécurisée et accessible avec votre compte de l'Institut : aucun compte tiers n'est requis.
        </p>
      </div>
    </section>
  );
}
