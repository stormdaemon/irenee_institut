import { siteUrl } from "@/lib/seo";
import type { MetadataRoute } from "next";
import { blogArticles } from "@/lib/blog";

const baseUrl = siteUrl;
// Only publish modification dates for changes that we can document.
const searchRelaunchUpdatedAt = new Date("2026-10-09T00:00:00+02:00");
const updatedRoutes = new Set(["", "/a-propos", "/formations", "/blog", "/institut-apologetique", "/apologetique-pour-etudiants"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/institut-apologetique",
    "/apologetique-pour-etudiants",
    "/ecole-apologetique-en-ligne",
    "/programme-apologetique",
    "/choisir-formation-apologetique",
    "/ressources-apologetique",
    "/bibliotheque-apologetique",
    "/formations",
    "/recuperer-mon-pass",
    "/blog",
    "/equipe",
    "/a-propos",
    "/contact",
    "/mentions-legales",
    "/politique-confidentialite",
    "/cgv"
  ];

  return [
    ...staticRoutes.map(route => ({
      url: `${baseUrl}${route || "/"}`,
      ...(updatedRoutes.has(route) ? { lastModified: searchRelaunchUpdatedAt } : {}),
      changeFrequency: route === "/blog" ? "weekly" as const : "monthly" as const,
      priority: route === "" ? 1 : route === "/blog" ? 0.95 : route === "/institut-apologetique" ? 0.95 : 0.8
    })),
    ...blogArticles.map(article => ({
      url: `${baseUrl}/blog/${article.slug}`,
      lastModified: new Date(`${article.date}T12:00:00+02:00`),
      changeFrequency: "monthly" as const,
      priority: article.featured ? 0.9 : 0.82
    }))
  ];
}
