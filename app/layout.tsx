import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FloatingNetworkMenu } from "@/components/FloatingNetworkMenu";

export const metadata: Metadata = {
  metadataBase: new URL("https://irenee-institut.org"),
  title: {
    default: "Institut Irénée",
    template: "%s | Institut Irénée"
  },
  description: "Formation certifiante en apologétique catholique.",
  openGraph: {
    title: "Institut Irénée",
    description: "Rendre compte de la crédibilité de la foi catholique.",
    url: "https://irenee-institut.org",
    siteName: "Institut Irénée",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Institut Irénée - Formation certifiante en apologétique catholique"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Institut Irénée",
    description: "Formation certifiante en apologétique catholique.",
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
        <Header />
        <FloatingNetworkMenu />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
