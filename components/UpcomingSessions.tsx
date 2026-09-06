"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Phone, Radio, Share2, User, Video } from "lucide-react";
import { useState } from "react";
import {
  buildVisioWhatsAppShareUrl,
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
          sizes="(max-width: 640px) 70vw, 220px"
          style={{ objectFit: "cover", objectPosition: session.imagePosition }}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function JoinSessionButton({ session }: { session: VisioSession }) {
  return (
    <Link className="btn btn-gold visio-participate" href={`/direct/${session.liveSessionId}`}>
      <Video size={17} /> Participer
    </Link>
  );
}

function ShareSessionButton({ session }: { session: VisioSession }) {
  return (
    <a
      className="btn btn-outline visio-share"
      href={buildVisioWhatsAppShareUrl(session)}
      target="_blank"
      rel="noreferrer"
      aria-label={`Partager la séance "${session.title}" sur WhatsApp`}
    >
      <Share2 size={15} /> Partager
    </a>
  );
}

export function UpcomingSessions({ sessions }: { sessions: VisioSession[] }) {
  const firstSession = sessions[0];

  return (
    <section className="section visio-section" id="agenda">
      <div className="container">
        <div className="visio-head">
          <span className="hero-eyebrow">
            <Radio size={16} /> En direct &middot; chaque mercredi à 20h30
          </span>
          <h2 className="visio-title font-display">Prochaines rencontres en visioconférence</h2>
          <p className="visio-lead">
            Chaque mercredi soir, la promotion se retrouve en direct depuis le site pour travailler,
            échanger et lire ensemble les Pères de l&apos;Église. Découvrez les prochaines rencontres annoncées.
          </p>
          <p className="visio-lead">Les rencontres de cet agenda sont accessibles avec un compte gratuit. Pour suivre l&apos;ensemble des cours à votre rythme, découvrez le pass annuel : 99 € conseillés, participation libre.</p>
          <p className="visio-contact-note">
            <Phone size={17} />
            <span>Pour toute autre question, appelez le <a href="tel:+33171681538">01.71.68.15.38</a>.</span>
          </p>
        </div>

        {firstSession ? <div className="visio-board">
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
              <span className="badge">Prochaine rencontre</span>
              <h3>{firstSession.title}</h3>
              {firstSession.presenter && <span className="visio-presenter">Animée par {firstSession.presenter}</span>}
              <p>{firstSession.description}</p>
              <strong>{formatVisioWhen(firstSession)}</strong>
              <div className="visio-spotlight-actions">
                <JoinSessionButton session={firstSession} />
                <ShareSessionButton session={firstSession} />
              </div>
            </div>
          </article>

          <ol className="visio-schedule">
            {sessions.slice(1).map(session => {
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
                    {session.presenter && <span className="visio-presenter">Animée par {session.presenter}</span>}
                    <p>{session.description}</p>
                    <div className="visio-session-actions">
                      <JoinSessionButton session={session} />
                      <ShareSessionButton session={session} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div> : <p className="visio-lead">Les prochaines dates seront annoncées ici. Les cours restent accessibles dans l&apos;espace étudiant.</p>}

        <div className="visio-actions">
          <Link className="btn btn-gold" href={firstSession ? `/direct/${firstSession.liveSessionId}` : "/espace-etudiant"}>
            <Video size={18} /> {firstSession ? "Préparer ma prochaine séance" : "Accéder à mon espace étudiant"}
          </Link>
          <Link className="btn btn-outline" href="/formations">
            Voir les formations <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
