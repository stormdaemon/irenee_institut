"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Phone, Radio, Share2, User, Video } from "lucide-react";
import { useEffect, useState } from "react";
import {
  VISIO_SESSIONS,
  buildVisioWhatsAppShareUrl,
  formatVisioDate,
  formatVisioWhen,
  type VisioSession
} from "@/lib/live-sessions";
import { createBrowserClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type SupabaseBrowserClient = NonNullable<ReturnType<typeof createBrowserClient>>;

function useConnectedStudent() {
  const [isConnectedStudent, setIsConnectedStudent] = useState(false);

  useEffect(() => {
    const client = createBrowserClient();
    if (!client) return;

    let mounted = true;

    async function loadProfile(supabase: SupabaseBrowserClient) {
      const { data, error } = await supabase.auth
        .getUser()
        .catch(() => ({ data: { user: null }, error: new Error("Session invalide") }));

      if (!mounted) return;
      if (error || !data.user) {
        setIsConnectedStudent(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!mounted) return;
      const profile = profileData as Pick<Profile, "role"> | null;
      setIsConnectedStudent((profile?.role || "etudiant") === "etudiant");
    }

    loadProfile(client);
    const { data: listener } = client.auth.onAuthStateChange(() => loadProfile(client));

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return isConnectedStudent;
}

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
          quality={95}
          style={{ objectFit: "cover", objectPosition: session.imagePosition }}
          onError={() => setFailed(true)}
        />
      )}
    </span>
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

export function UpcomingSessions() {
  const firstSession = VISIO_SESSIONS[0];
  const isConnectedStudent = useConnectedStudent();

  return (
    <section className="section visio-section" id="agenda">
      <div className="container">
        <div className="visio-head">
          <span className="hero-eyebrow">
            <Radio size={16} /> En direct &middot; chaque mercredi à 20h30
          </span>
          <h2 className="visio-title font-display">Premières rencontres en visio conférence à partir de septembre 2026</h2>
          <p className="visio-lead">
            Chaque mercredi soir, la promotion se retrouve en direct depuis le site pour travailler,
            échanger et lire ensemble les Pères de l&apos;Église. Voici les premières rencontres annoncées.
          </p>
          <p className="visio-contact-note">
            <Phone size={17} />
            <span>Pour toute autre question, appelez le <a href="tel:+33171681538">01.71.68.15.38</a>.</span>
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
              <div className="visio-spotlight-actions">
                {isConnectedStudent && (
                  <Link className="btn btn-gold visio-participate" href="/espace-etudiant">
                    <Video size={17} /> Je participe
                  </Link>
                )}
                <ShareSessionButton session={firstSession} />
              </div>
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
                    <div className="visio-session-actions">
                      {isConnectedStudent && (
                        <Link className="btn btn-gold visio-participate" href="/espace-etudiant">
                          <Video size={17} /> Je participe
                        </Link>
                      )}
                      <ShareSessionButton session={session} />
                    </div>
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
