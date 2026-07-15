import type { MetadataRoute } from "next";
import { blogArticles } from "@/lib/blog";

const baseUrl = "https://irenee-institut.org";
const publicContentUpdatedAt = new Date("2026-07-15T18:30:00+02:00");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/institut-apologetique",
    "/ecole-apologetique-en-ligne",
    "/programme-apologetique",
    "/choisir-formation-apologetique",
    "/ressources-apologetique",
    "/bibliotheque-apologetique",
    "/presse/liberation-institut-saint-irenee-2026",
    "/formations",
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
      url: `${baseUrl}${route}`,
      lastModified: publicContentUpdatedAt,
      changeFrequency: route === "/blog" ? "weekly" as const : "monthly" as const,
      priority: route === "" ? 1 : route === "/blog" ? 0.95 : route === "/institut-apologetique" ? 0.95 : 0.8
    })),
    ...blogArticles.map(article => ({
      url: `${baseUrl}/blog/${article.slug}`,
      lastModified: publicContentUpdatedAt,
      changeFrequency: "monthly" as const,
      priority: article.featured ? 0.9 : 0.82
    }))
  ];
}
