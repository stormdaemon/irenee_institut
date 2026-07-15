import { createHmac, timingSafeEqual } from "node:crypto";

const SITE_URL = "https://irenee-institut.org";

function optoutKey() {
  const secret = String(process.env.LOCAL_AUTH_JWT_SECRET || "").trim();
  if (!secret) throw new Error("LOCAL_AUTH_JWT_SECRET is not configured.");
  return secret;
}

export function emailOptoutToken(profileId: string) {
  return createHmac("sha256", optoutKey()).update(`email-optout:${profileId}`).digest("hex");
}

export function verifyEmailOptoutToken(profileId: string, token: string) {
  if (!profileId || !token) return false;
  const expected = Buffer.from(emailOptoutToken(profileId));
  const received = Buffer.from(String(token));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function emailOptoutUrl(profileId: string) {
  return `${SITE_URL}/api/emails/desinscription?profil=${encodeURIComponent(profileId)}&jeton=${emailOptoutToken(profileId)}`;
}
