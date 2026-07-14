export const STRIPE_CHECKOUT_ORIGIN = "https://checkout.stripe.com";

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
