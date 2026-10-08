import { expect, test } from "bun:test";
import { blogArticles, getBlogArticle } from "@/lib/blog";
import { schoolArticles } from "@/lib/blog-school";
import { dossierArticles } from "@/lib/blog-dossiers";
import { generateMetadata } from "@/app/blog/[slug]/page";
import sitemap from "@/app/sitemap";

test("published blog catalog includes existing school and dossier articles without duplicate slugs", () => {
  const slugs = blogArticles.map(article => article.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  for (const article of [...schoolArticles, ...dossierArticles]) {
    expect(getBlogArticle(article.slug)).toEqual(article);
  }
});

test("the published blog catalog keeps each article's canonical route data intact", () => {
  for (const article of blogArticles) {
    expect(article.slug).toMatch(/^[a-z0-9-]+$/);
    expect(article.title.length).toBeGreaterThan(10);
    expect(article.sections.length).toBeGreaterThan(0);
    expect(article.image.startsWith("/images/")).toBe(true);
  }
});

test("each published article exposes canonical and social metadata", async () => {
  for (const article of blogArticles) {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: article.slug }) });
    expect(metadata.alternates?.canonical).toBe(`/blog/${article.slug}`);
    expect(metadata.openGraph?.url).toBe(`/blog/${article.slug}`);
    expect(metadata.openGraph?.images).toBeDefined();
  }
});

test("sitemap includes the team page and every published article", () => {
  const urls = new Set(sitemap().map(entry => entry.url));
  expect(urls.has("https://apostolos-saint-irenee.duckdns.org/equipe")).toBe(true);
  for (const article of blogArticles) {
    expect(urls.has(`https://apostolos-saint-irenee.duckdns.org/blog/${article.slug}`)).toBe(true);
  }
});
