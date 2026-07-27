export const STRIPE_CHECKOUT_ORIGIN = "https://checkout.stripe.com";

// Secret d'une session affichée sur le site : il n'ouvre que le paiement de
// cette session et doit rester lié à l'identifiant renvoyé par Stripe.
export function isStripeCheckoutClientSecret(value: unknown, sessionId?: unknown): value is string {
  if (typeof value !== "string") return false;
  const candidate = value.trim();
  if (candidate.length < 20 || candidate.length > 512) return false;
  if (!/^cs_(?:live|test)_[A-Za-z0-9]+_secret_[A-Za-z0-9_-]+$/.test(candidate)) return false;
  if (sessionId === undefined) return true;
  return typeof sessionId === "string" && sessionId.trim() !== "" && candidate.startsWith(`${sessionId.trim()}_secret_`);
}

export function isAllowedStripeCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:"
      && parsed.hostname === "checkout.stripe.com"
      && parsed.port === ""
      && parsed.username === ""
      && parsed.password === "";
  } catch {
    return false;
  }
}
