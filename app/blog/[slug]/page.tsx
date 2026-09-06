import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, ExternalLink } from "lucide-react";
import { blogArticles, formatArticleDate, getBlogArticle, getRelatedArticles } from "@/lib/blog";
import { JsonLd } from "@/components/JsonLd";

type BlogArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return blogArticles.map(article => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getBlogArticle(slug);

  if (!article) {
    return {
      title: "Article introuvable"
    };
  }

  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: `/blog/${article.slug}`
    },
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      url: `/blog/${article.slug}`,
      publishedTime: article.date,
      images: [
        {
          url: article.image,
          width: 1024,
          height: 1024,
          alt: article.imageAlt
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: [article.image]
    }
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const article = getBlogArticle(slug);

  if (!article) notFound();

  const related = getRelatedArticles(article);
  const articleUrl = `https://irenee-institut.org/blog/${article.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    image: `https://irenee-institut.org${article.image}`,
    datePublished: article.date,
    dateModified: article.date,
    author: {
      "@type": "Organization",
      name: "Institut Saint Irénée"
    },
    publisher: {
      "@type": "Organization",
      name: "Institut Saint Irénée",
      logo: {
        "@type": "ImageObject",
        url: "https://irenee-institut.org/images/logo_without_text.png"
      }
    },
    mainEntityOfPage: articleUrl
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <article>
        <section className="blog-article-hero">
          <Image src={article.image} alt={article.imageAlt} fill sizes="100vw" priority loading="eager" />
          <div className="blog-article-hero-overlay" />
          <div className="container">
            <Link className="blog-back-link" href="/blog">
              <ArrowLeft size={16} /> Blog
            </Link>
            <span className="hero-eyebrow">{article.category}</span>
            <h1 className="font-display">{article.title}</h1>
            <p>{article.description}</p>
            <div className="blog-meta light">
              <span><CalendarDays size={16} /> {formatArticleDate(article.date)}</span>
              <span><Clock size={16} /> {article.readingMinutes} min de lecture</span>
            </div>
          </div>
        </section>

        <section className="section blog-article-section">
          <div className="container blog-article-layout">
            <aside className="blog-article-aside">
              <div className="soft-card blog-aside-card">
                <span className="blog-kicker">Repères</span>
                <ul>
                  {article.takeaways.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="soft-card blog-aside-card">
                <span className="blog-kicker">Thèmes</span>
                <div className="blog-tag-list">
                  {article.tags.map(tag => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </aside>

            <div className="blog-article-content">
              <div className="blog-intro">
                {article.intro.map(paragraph => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              <section className="blog-conversion-panel">
                <span className="blog-kicker">Formation structurée</span>
                <h2>Passer de l'article au cursus complet</h2>
                <p>
                  Le pass annuel donne accès aux cours d'apologétique, aux modules progressifs, aux séances en direct
                  et aux validations de parcours dans l'espace étudiant.
                </p>
                <Link className="btn btn-gold" href="/formations?checkout=annual-pass">
                  Obtenir le pass annuel <ArrowRight size={17} />
                </Link>
              </section>

              {article.sections.map(section => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map(paragraph => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </section>
              ))}

              <section className="blog-source-panel">
                <h2>Pour aller plus loin</h2>
                <ul>
                  {article.sources.map(source => {
                    const external = source.url.startsWith("http");
                    const content = (
                      <>
                        {source.label}
                        {external && <ExternalLink size={15} aria-hidden="true" />}
                      </>
                    );

                    return (
                      <li key={source.id}>
                        {external ? (
                          <a href={source.url} target="_blank" rel="noreferrer">{content}</a>
                        ) : (
                          <Link href={source.url}>{content}</Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="blog-source-panel">
                <h2>Se former avec l'Institut Saint Irénée</h2>
                <p>
                  Vous souhaitez relier ces repères à un parcours structuré ? Découvrez l'Institut d'Apologétique
                  Irénée et les formations accessibles en ligne.
                </p>
                <p>
                  <Link className="feature-link" href="/institut-apologetique">
                    Découvrir l'Institut d'Apologétique <ArrowRight size={14} />
                  </Link>
                </p>
                <p>
                  <Link className="feature-link" href="/#agenda">
                    Découvrir les prochaines rencontres en ligne <ArrowRight size={14} />
                  </Link>
                </p>
                <p>
                  <Link className="feature-link" href="/formations">
                    Voir les formations <ArrowRight size={14} />
                  </Link>
                </p>
              </section>
            </div>
          </div>
        </section>
      </article>

      <section className="section blog-related-section">
        <div className="container">
          <div className="blog-section-head compact">
            <div>
              <span className="blog-kicker">Continuer la lecture</span>
              <h2 className="section-title">Articles liés</h2>
            </div>
          </div>
          <div className="blog-card-grid related">
            {related.map(item => (
              <article className="card blog-card" key={item.slug}>
                <Link href={`/blog/${item.slug}`} className="blog-card-image">
                  <Image src={item.image} alt={item.imageAlt} fill sizes="(max-width: 700px) 100vw, 33vw" />
                </Link>
                <div className="blog-card-body">
                  <span className="badge">{item.category}</span>
                  <h3><Link href={`/blog/${item.slug}`}>{item.title}</Link></h3>
                  <p>{item.description}</p>
                  <Link className="feature-link" href={`/blog/${item.slug}`}>
                    Lire <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
