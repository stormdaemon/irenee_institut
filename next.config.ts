import type { NextConfig } from "next";
import { cleanAnnualPassSignupPath } from "./lib/routes";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      },
      {
        source: cleanAnnualPassSignupPath,
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive"
          }
        ]
      },
      {
        source: "/(admin|auth|cours|devoirs|espace-etudiant|examen-final|parametres)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }
        ]
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" }
        ]
      }
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lebaptemecatholique.fr" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "bilan-previsionnel.fr" }
    ]
  }
};

export default nextConfig;
