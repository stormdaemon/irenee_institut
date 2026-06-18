import type { Metadata } from "next";

export const siteUrl = "https://irenee-institut.org";
export const siteName = "Institut d'Apologétique Saint Irénée";
export const organizationName = "Institut Irénée";
export const siteDescription =
  "L'institut d'Apologétique Saint Irénée propose des formations catholiques structurées en ligne pour comprendre, défendre et transmettre la foi avec rigueur et charité.";

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
  alternateName: siteName,
  url: siteUrl,
  logo: `${siteUrl}/images/logo_without_text.png`,
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
  alternateName: organizationName,
  inLanguage: "fr-FR",
  publisher: {
    "@id": `${siteUrl}/#organization`
  }
};

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
