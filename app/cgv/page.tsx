import Link from "next/link";
import type { Metadata } from "next";
import { markdownToHtml } from "@/lib/markdown";
import { getLegalPage } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  description: "Consultez les conditions générales de vente des formations de l'Institut d'Apologétique Saint Irénée.",
  alternates: {
    canonical: "/cgv"
  }
};

export default async function TermsPage() {
  const page = await getLegalPage("cgv");

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
          <p style={{ marginTop: 24 }}><Link href="/formations?checkout=annual-pass" className="btn btn-primary">Obtenir le pass annuel</Link></p>
        </div>
      </section>
    </>
  );
}
