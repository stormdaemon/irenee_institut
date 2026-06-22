import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, CalendarDays, Clock, Sparkles } from "lucide-react";
import { blogArticles, blogCategories, formatArticleDate, getFeaturedArticles } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog apologétique catholique",
  description: "Articles de l'Institut Saint Irénée, premier Institut d'Apologétique en France, pour approfondir la foi catholique et apprendre à en rendre compte.",
  alternates: {
    canonical: "/blog"
  },
  openGraph: {
    title: "Blog apologétique catholique | Institut Saint Irénée",
    description: "Approfondir la foi, répondre aux objections et se former à l'école du Bon Pasteur.",
    url: "/blog",
    images: [
      {
        url: "/images/blog/institut-apologetique-france.png",
        width: 1024,
        height: 1024,
        alt: "Blog de l'Institut Saint Irénée"
      }
    ]
  }
};

function categoryId(category: string) {
  return category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function BlogPage() {
  const featured = getFeaturedArticles();
  const leadArticle = featured[0] || blogArticles[0];
  const secondaryFeatured = featured.slice(1, 5);

  return (
    <>
      <section className="page-hero blog-index-hero">
        <div className="container">
          <span className="hero-eyebrow">Premier Institut d'Apologétique en France</span>
          <h1 className="font-display">Blog d'apologétique catholique</h1>
          <p>
            Articles, repères et réponses pour comprendre la foi, la transmettre avec charité et marcher à l'école du Bon Pasteur.
          </p>
          <div className="blog-hero-stats" aria-label="Statistiques du blog">
            <span><BookOpen size={18} /> {blogArticles.length} articles</span>
            <span><Sparkles size={18} /> {blogCategories.length} dossiers</span>
            <span><Clock size={18} /> lectures approfondies</span>
          </div>
        </div>
      </section>

      <section className="section blog-featured-section">
        <div className="container">
          <div className="blog-section-head">
            <div>
              <span className="blog-kicker">À lire d'abord</span>
              <h2 className="section-title">Les grands repères</h2>
            </div>
            <p className="subtitle">
              Une sélection pour entrer dans l'esprit de l'Institut Saint Irénée : raison, sources, mission et suite du Bon Pasteur.
            </p>
          </div>

          <div className="blog-featured-grid">
            <article className="card blog-lead-card">
              <Link href={`/blog/${leadArticle.slug}`} className="blog-lead-image">
                <Image src={leadArticle.image} alt={leadArticle.imageAlt} fill sizes="(max-width: 900px) 100vw, 56vw" priority />
              </Link>
              <div className="blog-lead-content">
                <span className="badge">{leadArticle.category}</span>
                <h2><Link href={`/blog/${leadArticle.slug}`}>{leadArticle.title}</Link></h2>
                <p>{leadArticle.description}</p>
                <div className="blog-meta">
                  <span><CalendarDays size={15} /> {formatArticleDate(leadArticle.date)}</span>
                  <span><Clock size={15} /> {leadArticle.readingMinutes} min</span>
                </div>
                <Link className="btn btn-gold" href={`/blog/${leadArticle.slug}`}>
                  Lire l'article <ArrowRight size={17} />
                </Link>
              </div>
            </article>

            <div className="blog-featured-list">
              {secondaryFeatured.map(article => (
                <article className="soft-card blog-mini-card" key={article.slug}>
                  <Link href={`/blog/${article.slug}`} className="blog-mini-image">
                    <Image src={article.image} alt={article.imageAlt} fill sizes="180px" />
                  </Link>
                  <div>
                    <span className="blog-kicker">{article.category}</span>
                    <h3><Link href={`/blog/${article.slug}`}>{article.title}</Link></h3>
                    <p>{article.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section blog-categories-section">
        <div className="container">
          <div className="blog-section-head compact">
            <div>
              <span className="blog-kicker">Dossiers</span>
              <h2 className="section-title">Explorer par thème</h2>
            </div>
          </div>
          <div className="blog-category-grid">
            {blogCategories.map(category => {
              const count = blogArticles.filter(article => article.category === category).length;
              return (
                <a className="soft-card blog-category-card" key={category} href={`#${categoryId(category)}`}>
                  <strong>{category}</strong>
                  <span>{count} article{count > 1 ? "s" : ""}</span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section blog-all-section">
        <div className="container">
          {blogCategories.map(category => {
            const articles = blogArticles.filter(article => article.category === category);
            return (
              <div className="blog-category-block" id={categoryId(category)} key={category}>
                <div className="blog-category-title">
                  <span className="blog-kicker">{articles.length} article{articles.length > 1 ? "s" : ""}</span>
                  <h2 className="font-display">{category}</h2>
                </div>
                <div className="blog-card-grid">
                  {articles.map(article => (
                    <article className="card blog-card" key={article.slug}>
                      <Link href={`/blog/${article.slug}`} className="blog-card-image">
                        <Image src={article.image} alt={article.imageAlt} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" />
                      </Link>
                      <div className="blog-card-body">
                        <span className="badge">{article.category}</span>
                        <h3><Link href={`/blog/${article.slug}`}>{article.title}</Link></h3>
                        <p>{article.description}</p>
                        <div className="blog-meta">
                          <span><CalendarDays size={14} /> {formatArticleDate(article.date)}</span>
                          <span><Clock size={14} /> {article.readingMinutes} min</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
