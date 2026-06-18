"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Radio, User, Video } from "lucide-react";
import { useState } from "react";
import {
  VISIO_SESSIONS,
  formatVisioDate,
  formatVisioWhen,
  type VisioSession
} from "@/lib/live-sessions";

// Vignette tolérante : tant que l'illustration patristique n'est pas déposée
// dans public/images, on affiche un repli sobre (dégradé + emblème) au lieu d'une
// image cassée. Dès que le fichier existe, il recouvre le repli sans toucher au code.
function SessionThumb({ session }: { session: VisioSession }) {
  const [failed, setFailed] = useState(false);
  const FallbackIcon = session.kind === "person" ? User : BookOpen;

  return (
    <span className="visio-thumb">
      <span className="visio-thumb-fallback" aria-hidden="true">
        <FallbackIcon size={28} strokeWidth={1.4} />
      </span>
      {!failed && (
        <Image
          src={session.image}
          alt={session.imageAlt}
          fill
          sizes="84px"
          style={{ objectFit: "cover", objectPosition: session.imagePosition }}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function UpcomingSessions() {
  const firstSession = VISIO_SESSIONS[0];

  return (
    <section className="section visio-section">
      <div className="container">
        <div className="visio-head">
          <span className="hero-eyebrow">
            <Radio size={16} /> En direct &middot; chaque mercredi à 20h30
          </span>
          <h2 className="visio-title font-display">Les séances en visio reprennent en septembre</h2>
          <p className="visio-lead">
            Chaque mercredi soir, la promotion se retrouve en direct depuis le site pour travailler,
            échanger et lire ensemble les Pères de l&apos;Église. Voici les premières séances de la rentrée.
          </p>
        </div>

        <div className="visio-board">
          <article className="visio-spotlight">
            <div className="visio-spotlight-image">
              <Image
                src={firstSession.image}
                alt={firstSession.imageAlt}
                fill
                sizes="(max-width: 900px) 100vw, 36vw"
                style={{ objectFit: "cover", objectPosition: firstSession.imagePosition }}
              />
            </div>
            <div className="visio-spotlight-copy">
              <span className="badge">Première soirée</span>
              <h3>{firstSession.title}</h3>
              <p>{firstSession.description}</p>
              <strong>{formatVisioWhen(firstSession)}</strong>
            </div>
          </article>

          <ol className="visio-schedule">
            {VISIO_SESSIONS.slice(1).map(session => {
              const { day, monthShort } = formatVisioDate(session.isoDate);
              return (
                <li className="visio-session" key={session.isoDate}>
                  <span className="visio-chip" aria-hidden="true">
                    <strong>{day}</strong>
                    <span>{monthShort}</span>
                  </span>
                  <SessionThumb session={session} />
                  <div className="visio-session-body">
                    <span className="visio-when">{formatVisioWhen(session)}</span>
                    <h3>{session.title}</h3>
                    <p>{session.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="visio-actions">
          <Link className="btn btn-gold" href="/espace-etudiant">
            <Video size={18} /> Rejoindre les séances en direct
          </Link>
          <Link className="btn btn-outline" href="/formations">
            Voir les formations <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
