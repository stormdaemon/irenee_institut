import Link from "next/link";
import type { Metadata } from "next";
import { markdownToHtml } from "@/lib/markdown";
import { getLegalPage } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Consultez les mentions légales de l'Institut d'Apologétique Saint Irénée.",
  alternates: {
    canonical: "/mentions-legales"
  }
};

export default async function LegalNoticePage() {
  const page = await getLegalPage("mentions-legales");

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
            <div className="legal-content" dangerouslySetInnerHTML={{ __html: markdownToHtml(page.content) }} />
          </article>
          <p style={{ marginTop: 24 }}><Link href="/contact" className="btn btn-outline">Nous contacter</Link></p>
        </div>
      </section>
    </>
  );
}
