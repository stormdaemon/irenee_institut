import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/espace-etudiant", "/devoirs", "/parametres"]
    },
    sitemap: "https://irenee-institut.org/sitemap.xml"
  };
}
