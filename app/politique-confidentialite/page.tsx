import Link from "next/link";
import { markdownToHtml } from "@/lib/markdown";
import { getLegalPage } from "@/lib/server-data";

export const dynamic = "force-dynamic";

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
            <div className="legal-content" dangerouslySetInnerHTML={{ __html: markdownToHtml(page.content) }} />
          </article>
          <p style={{ marginTop: 24 }}><Link href="/parametres" className="btn btn-outline">Gérer mon compte</Link></p>
        </div>
      </section>
    </>
  );
}
