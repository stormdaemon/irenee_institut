import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { RadioPlayer } from "@/components/RadioPlayer";
import { DeferredClientChrome } from "@/components/DeferredClientChrome";
import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd, siteDescription, siteName, siteUrl, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Institut d'Apologétique Saint Irénée | Formation catholique en ligne",
    template: `%s | ${siteName}`
  },
  description: siteDescription,
  openGraph: {
    title: "Institut d'Apologétique Saint Irénée",
    description: siteDescription,
    url: siteUrl,
    siteName,
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Institut d'Apologétique Saint Irénée - Formation catholique en ligne"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Institut d'Apologétique Saint Irénée",
    description: siteDescription,
    images: ["/twitter-image.png"]
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a className="skip-link" href="#main-content">Aller au contenu principal</a>
        <JsonLd data={organizationJsonLd} />
        <JsonLd data={websiteJsonLd} />
        <div className="site-chrome">
          <RadioPlayer />
          <Header />
        </div>
        <DeferredClientChrome />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
