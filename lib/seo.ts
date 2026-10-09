import type { Metadata } from "next";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://apostolos-saint-irenee.duckdns.org";
export const siteName = "Institut Apostolos Saint Irénée";
export const organizationName = "Institut Apostolos Saint Irénée";
export const instituteAliases = [
  "Institut Saint Irénée",
  "Institut d’Apologétique Saint Irénée",
  "Institut d’Apologétique Apostolos Saint Irénée"
];
export const siteDescription =
  "L'Institut Apostolos Saint Irénée propose des formations catholiques structurées en ligne pour comprendre, défendre et transmettre la foi avec rigueur et charité.";

export const privatePageMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "@id": `${siteUrl}/#organization`,
  name: organizationName,
  alternateName: instituteAliases,
  url: siteUrl,
  logo: `${siteUrl}/images/apostolos/vitrail/emblem.webp`,
  description: siteDescription,
  email: "oeuvrecatholiquefrance@gmail.com",
  telephone: "+33171681538",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1 rue de Stockholm",
    postalCode: "75008",
    addressLocality: "Paris",
    addressCountry: "FR"
  },
  parentOrganization: {
    "@type": "Organization",
    name: "Parole et Partage",
    identifier: "SIREN 841 890 692"
  }
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  url: siteUrl,
  name: siteName,
  alternateName: ["Apostolos", ...instituteAliases],
  inLanguage: "fr-FR",
  publisher: {
    "@id": `${siteUrl}/#organization`
  }
};

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title: { absolute: title }, description,
    alternates: { canonical: path },
    openGraph: {
      title, description, url: path, siteName, type: "website", locale: "fr_FR",
      images: [{ url: "/images/apostolos/vitrail/hero.webp", alt: siteName }]
    },
    twitter: { card: "summary_large_image", title, description, images: ["/images/apostolos/vitrail/hero.webp"] }
  };
}
