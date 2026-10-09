import { expect, test } from "bun:test";
import { metadata as home } from "@/app/page";
import { metadata as about } from "@/app/a-propos/page";
import { metadata as courses } from "@/app/formations/page";
import { organizationJsonLd, siteUrl } from "@/lib/seo";
import sitemap from "@/app/sitemap";
import { getBlogArticle, blogArticles } from "@/lib/blog";
import { historicalArticles } from "@/lib/blog-history";

test("public entry pages identify their own canonical URL, including social previews", () => {
  for (const [metadata, path] of [[home, "/"], [about, "/a-propos"], [courses, "/formations"]] as const) {
    expect(metadata.alternates?.canonical).toBe(path);
    expect(metadata.openGraph?.url).toBe(path);
    expect(metadata.description).toBeTruthy();
  }
});

test("the institute entity connects the historical and Apostolos names with its current logo", () => {
  expect(organizationJsonLd.alternateName).toContain("Institut Saint Irénée");
  expect(organizationJsonLd.alternateName).toContain("Institut d’Apologétique Apostolos Saint Irénée");
  expect(organizationJsonLd.logo).toBe(`${siteUrl}/images/apostolos/vitrail/emblem.webp`);
});

test("the student search-intent page is discoverable without indexing private course readers", () => {
  const urls = sitemap().map(entry => new URL(entry.url).pathname);
  expect(urls).toContain("/apologetique-pour-etudiants");
  expect(urls.some(path => /^\/(admin|auth|cours)(\/|$)/.test(path))).toBe(false);
});

test("sitemap dates describe known changes rather than fabricated freshness for every URL", () => {
  const routes = sitemap();
  expect(routes.find(entry => entry.url === `${siteUrl}/`)?.lastModified).toEqual(new Date("2026-10-09T00:00:00+02:00"));
  expect(routes.find(entry => entry.url === `${siteUrl}/cgv`)?.lastModified).toBeUndefined();
});

test("historical editorial URLs linked by the institute still resolve to their original subjects", () => {
  for (const slug of ["qu-est-ce-que-l-apologetique-catholique", "foi-et-raison-deux-lumieres", "manuscrits-bibliques-histoire-solide", "credo-nicee-garder-visage-du-christ", "science-et-foi-sortir-des-caricatures", "preuves-de-dieu-chemins-de-raison", "dialogue-avec-islam-clarte-respect-christ"]) {
    expect(getBlogArticle(slug)?.sections.length).toBeGreaterThan(0);
  }
});

test("restored articles retain their publication dates and all illustrations exist", async () => {
  expect(historicalArticles).toHaveLength(40);
  for (const article of historicalArticles) {
    expect(getBlogArticle(article.slug)).toEqual(article);
    expect(article.date < "2026-10-09").toBe(true);
    expect(article.sources.length).toBeGreaterThan(0);
  }
  for (const article of blogArticles) expect(await Bun.file(`public${article.image}`).exists()).toBe(true);
});
