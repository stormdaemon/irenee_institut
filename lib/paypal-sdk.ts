export const PAYPAL_CHECKOUT_LOCALE = "fr_FR";

export function buildPayPalSdkUrl({ clientId, currency }: { clientId: string; currency: string }) {
  const params = new URLSearchParams({
    "client-id": clientId,
    currency: currency || "EUR",
    intent: "capture",
    components: "buttons",
    locale: PAYPAL_CHECKOUT_LOCALE
  });

  return `https://www.paypal.com/sdk/js?${params.toString()}`;
}
