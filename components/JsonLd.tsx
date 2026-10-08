import { headers } from "next/headers";
import { serializeJsonLd } from "@/lib/seo";

export async function JsonLd({ data }: { data: unknown }) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <script
      // Browsers redact nonce attributes after parsing; the CSP nonce remains intact.
      suppressHydrationWarning
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
