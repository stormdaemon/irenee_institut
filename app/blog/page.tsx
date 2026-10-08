import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { EditorialBanner } from "@/components/EditorialBanner";
import { JsonLd } from "@/components/JsonLd";
import { blogArticles } from "@/lib/blog";
import { siteName, siteUrl } from "@/lib/seo";

const description = "Lectures, questions et repères pour approfondir la foi catholique et nourrir le dialogue.";

export const metadata: Metadata = {
  title: "Le journal Apostolos",
  description,
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    url: "/blog",
    title: "Le journal Apostolos",
    description,
    siteName,
    images: [{ url: "/images/apostolos/raison.png", alt: "Le journal de l’Institut Apostolos Saint Irénée" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Le journal Apostolos",
    description,
    images: ["/images/apostolos/raison.png"]
  }
};

export default function BlogPage() {
  const listingJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Le journal Apostolos",
    description,
    url: `${siteUrl}/blog`,
    publisher: { "@type": "Organization", name: siteName, url: siteUrl },
    blogPost: blogArticles.map(article => ({
      "@type": "BlogPosting",
      headline: article.title,
      url: `${siteUrl}/blog/${article.slug}`,
      datePublished: article.date,
      description: article.description
    }))
  };

  return (
    <div className="apostolos-wrap">
      <JsonLd data={listingJsonLd} />
      <EditorialBanner image="/images/apostolos/raison.png" label="LE JOURNAL">
        <h1>Les questions ouvrent<br /><em>de nouveaux chemins.</em></h1>
        <p>Des lectures pour aller plus loin. Des repères pour penser par soi-même. Un espace de réflexion au croisement de la foi, de l’histoire et de la raison.</p>
      </EditorialBanner>
      <section className="apostolos-section" aria-label="Articles du journal">
        <div className="apostolos-section-head">
          <h2>Articles et dossiers</h2>
          <span className="apostolos-label">{blogArticles.length} LECTURES</span>
        </div>
        <div className="apostolos-journal-grid">
          {blogArticles.map(article => (
            <article className="apostolos-journal-card" key={article.slug}>
              <Link href={`/blog/${article.slug}`}>
                <div className="apostolos-journal-image">
                  <Image src={article.image} alt={article.imageAlt} fill sizes="(max-width:520px) 100vw, (max-width:800px) 50vw, 33vw" />
                </div>
                <span className="apostolos-label">{article.category} · {article.readingMinutes} MIN DE LECTURE</span>
                <h2>{article.title}</h2>
                <p>{article.description}</p>
                <span className="apostolos-text-link">Lire l’article <ArrowUpRight size={17} /></span>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
