"use client";

import Link from "next/link";
import { CalendarClock, Radio, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

type StudentLiveSession = {
  id: string;
  titre: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  has_room: boolean;
};

export function NextLiveSession() {
  const [session, setSession] = useState<StudentLiveSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    authenticatedFetch("/api/live")
      .then(response => response.json())
      .then(data => {
        if (!mounted) return;
        if (data?.ok && Array.isArray(data.sessions) && data.sessions.length) {
          setSession(data.sessions[0]);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Stay silent until a session is available so the aside isn't cluttered.
  if (!loaded || !session) return null;

  const isLive = session.status === "live";

  return (
    <div className="card" style={{ padding: 24, marginBottom: 22 }}>
      <span className="badge">{isLive ? <><Radio size={14} /> En direct</> : "Prochaine séance"}</span>
      <h2 className="font-display" style={{ color: "var(--navy)", marginTop: 10 }}>{session.titre}</h2>
      {session.description && <p className="muted">{session.description}</p>}
      <p className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <CalendarClock size={16} /> {new Date(session.starts_at).toLocaleString("fr-FR")}
      </p>
      <Link className={`btn ${isLive ? "btn-primary" : "btn-outline"}`} href={`/direct/${session.id}`}>
        <Video size={18} /> {isLive ? "Rejoindre maintenant" : "Accéder à la séance"}
      </Link>
    </div>
  );
}
