export function buildContentSecurityPolicy(nonce?: string, development = false, upgradeInsecureRequests = true) {
  const scriptSources = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : []),
    ...(development ? ["'unsafe-eval'"] : []),
    "https://www.paypal.com",
    "https://www.paypalobjects.com",
    // Saisie carte affichée sur le site : Stripe.js et sa sonde antifraude.
    "https://js.stripe.com",
    "https://m.stripe.network"
  ];
  const styleSources = ["'self'", ...(nonce ? [`'nonce-${nonce}'`] : [])];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com https://www.paypal.com https://*.paypal.com",
    "img-src 'self' data: blob: https://res.cloudinary.com https://lebaptemecatholique.fr https://bilan-previsionnel.fr https://*.stripe.com",
    "font-src 'self' data:",
    "media-src 'self' https://play.radioking.io https://res.cloudinary.com",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    `style-src ${styleSources.join(" ")}`,
    `style-src-elem ${styleSources.join(" ")}`,
    // React's typed style properties are still used throughout the current UI.
    // Confine that compatibility exception to attributes; inline <style>
    // elements must carry the per-response nonce above.
    "style-src-attr 'unsafe-inline'",
    "connect-src 'self' https://www.paypal.com https://*.paypal.com https://api.stripe.com https://m.stripe.network",
    "frame-src https://checkout.stripe.com https://js.stripe.com https://hooks.stripe.com https://m.stripe.network https://www.paypal.com https://*.paypal.com https://www.google.com https://maps.google.com https://*.daily.co",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(upgradeInsecureRequests ? ["upgrade-insecure-requests"] : [])
  ].join("; ");
}

export const contentSecurityPolicy = buildContentSecurityPolicy();

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  {
    key: "Permissions-Policy",
    value: "accelerometer=(), autoplay=(self \"https://institutsaintirenee.daily.co\"), camera=(self \"https://institutsaintirenee.daily.co\"), display-capture=(\"https://institutsaintirenee.daily.co\"), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self \"https://institutsaintirenee.daily.co\"), payment=(self), usb=()"
  }
];
