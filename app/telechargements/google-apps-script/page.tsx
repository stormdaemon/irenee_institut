import type { Metadata } from "next";
import { requireDirectorPage } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Téléchargement Google Apps Script",
  robots: {
    follow: false,
    index: false
  }
};

export default async function GoogleAppsScriptDownloadPage() {
  await requireDirectorPage("/telechargements/google-apps-script");
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="soft-card" style={{ padding: 30 }}>
          <span className="hero-eyebrow">Fichier technique</span>
          <h1 className="font-display" style={{ color: "var(--navy)", marginTop: 8 }}>
            Google Apps Script complet
          </h1>
          <p className="muted">
            Ce fichier sensible est réservé aux comptes de direction authentifiés. Le téléchargement est journalisé.
          </p>
          <form action="/api/download/google-apps-script" method="post" style={{ display: "grid", gap: 14, marginTop: 24 }}>
            <button className="btn btn-primary" type="submit">
              Télécharger le fichier .gs
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
