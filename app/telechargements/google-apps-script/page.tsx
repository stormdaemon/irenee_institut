import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Téléchargement Google Apps Script",
  robots: {
    follow: false,
    index: false
  }
};

export default function GoogleAppsScriptDownloadPage() {
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="soft-card" style={{ padding: 30 }}>
          <span className="hero-eyebrow">Fichier technique</span>
          <h1 className="font-display" style={{ color: "var(--navy)", marginTop: 8 }}>
            Google Apps Script complet
          </h1>
          <p className="muted">
            Entrez le code de téléchargement transmis par l'équipe pour récupérer la version complète du script.
          </p>
          <form action="/api/download/google-apps-script" method="get" style={{ display: "grid", gap: 14, marginTop: 24 }}>
            <label>
              <span style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Code</span>
              <input className="input" name="code" type="password" autoComplete="off" required />
            </label>
            <button className="btn btn-primary" type="submit">
              Télécharger le fichier .gs
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
