import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FloatingNetworkMenu } from "@/components/FloatingNetworkMenu";
import { DonationPrompt } from "@/components/DonationPrompt";
import { organizationJsonLd, serializeJsonLd, siteDescription, siteName, siteUrl, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Institut d'Apologétique Irénée | Formation catholique en ligne",
    template: `%s | ${siteName}`
  },
  description: siteDescription,
  openGraph: {
    title: "Institut d'Apologétique Irénée",
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
        alt: "Institut d'Apologétique Irénée - Formation catholique en ligne"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Institut d'Apologétique Irénée",
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }} />
        <Header />
        <FloatingNetworkMenu />
        <DonationPrompt />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
