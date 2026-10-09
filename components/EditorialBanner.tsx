import Image from "next/image";
import type { ReactNode } from "react";
export function EditorialBanner({ image, label, children }: { image: string; label: string; children: ReactNode }) {
  return <header className="apostolos-editorial-banner"><Image src={image} alt="" fill priority sizes="100vw" /><div><span className="apostolos-label">{label}</span>{children}</div></header>;
}
