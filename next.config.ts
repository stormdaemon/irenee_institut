import type { NextConfig } from "next";
import { cleanAnnualPassSignupPath } from "./lib/routes";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
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
