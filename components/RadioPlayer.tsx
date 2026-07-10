"use client";

import { Pause, Play, Radio, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

const streamUrl = "https://play.radioking.io/heavenradio/731077";

export function RadioPlayer() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const isCourseWorkspace = pathname === "/cours"
    || pathname.startsWith("/cours/")
    || pathname === "/admin/courses"
    || pathname.startsWith("/admin/courses/");

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    setError("");

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError("Lecture impossible");
    }
  }

  function stop() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
    setError("");
  }

  if (isCourseWorkspace) return null;

  return (
    <div className="radio-bar">
      <div className="container radio-row">
        <div className="radio-player">
          <button className="radio-play" type="button" onClick={toggle} aria-label={playing ? "Mettre Heaven Radio en pause" : "Lancer Heaven Radio"}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <Radio size={18} color="var(--gold)" aria-hidden="true" />
          <div>
            <strong>Heaven Radio</strong>
            <span>100% Louange et Adoration</span>
          </div>
          {error && <small className="radio-error">{error}</small>}
        </div>
        <button className="radio-close" type="button" onClick={stop} aria-label="Arrêter Heaven Radio">
          <span>heavenradio.fr</span>
          <X size={16} />
        </button>
        <audio ref={audioRef} src={streamUrl} preload="none" onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      </div>
    </div>
  );
}
