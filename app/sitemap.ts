import type { MetadataRoute } from "next";
import { blogArticles } from "@/lib/blog";

const baseUrl = "https://irenee-institut.org";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/formations",
    "/blog",
    "/formateurs",
    "/a-propos",
    "/contact",
    "/mentions-legales",
    "/politique-confidentialite",
    "/cgv"
  ];

  return [
    ...staticRoutes.map(route => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: route === "/blog" ? "weekly" as const : "monthly" as const,
      priority: route === "" ? 1 : route === "/blog" ? 0.95 : 0.7
    })),
    ...blogArticles.map(article => ({
      url: `${baseUrl}/blog/${article.slug}`,
      lastModified: new Date(`${article.date}T12:00:00+02:00`),
      changeFrequency: "monthly" as const,
      priority: article.featured ? 0.9 : 0.82
    }))
  ];
}
