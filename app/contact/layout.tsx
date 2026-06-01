import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact et FAQ",
  description:
    "Contactez l'Institut d'Apologétique Saint Irénée et consultez les réponses aux questions fréquentes sur les formations catholiques en ligne.",
  alternates: {
    canonical: "/contact"
  }
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
