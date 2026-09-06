import Link from "next/link";
import type { Metadata } from "next";
import { markdownToHtml } from "@/lib/markdown";
import { getLegalPage } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Consultez la politique de confidentialité de l'Institut d'Apologétique Saint Irénée.",
  alternates: {
    canonical: "/politique-confidentialite"
  }
};

export default async function PrivacyPage() {
  const page = await getLegalPage("politique-confidentialite");

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1 className="font-display" style={{ fontSize: "4rem", margin: 0 }}>{page.title}</h1>
          <p style={{ fontSize: "1.25rem", color: "#dce6f6", maxWidth: 760 }}>{page.intro}</p>
        </div>
      </section>
      <section className="section" style={{ background: "white" }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <article className="card" style={{ padding: 34 }}>
            <div className="legal-content" dangerouslySetInnerHTML={{ __html: markdownToHtml(page.content, 1) }} />
          </article>
          <p style={{ marginTop: 24 }}><Link href="/parametres" className="btn btn-outline">Gérer mon compte</Link></p>
        </div>
      </section>
    </>
  );
}
