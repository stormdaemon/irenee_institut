import type { Course, Profile } from "@/lib/types";
import type { SystemSettings } from "@/lib/settings";

export const PAYPAL_CURRENCY = "EUR";
export const PAYPAL_DEFAULT_AMOUNT_CENTS = 9900;
export const PAYPAL_MIN_AMOUNT_CENTS = 100;
export const PAYPAL_WEBHOOK_URL = "https://irenee-institut.org/paypal_checkout_valid";

export const PAYPAL_CHECKOUT_WEBHOOK_EVENTS = [
  "CHECKOUT.ORDER.APPROVED",
  "CHECKOUT.PAYMENT-APPROVAL.REVERSED",
  "PAYMENT.CAPTURE.PENDING",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED"
] as const;

export type PayPalEnvironment = "live" | "sandbox";

export type PayPalConfig = {
  appName: string;
  clientId: string;
  clientSecret: string;
  webhookId: string;
  webhookUrl: string;
  environment: PayPalEnvironment;
};

export type PayPalOrderPayloadInput = {
  amountCents: number;
  bookRequested: boolean;
  course: Pick<Course, "id" | "slug" | "titre">;
  origin: string;
  profile: Pick<Profile, "id" | "email" | "prenom" | "nom">;
};

type FetchLike = typeof fetch;

function stringFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function trimForPayPal(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function getPayPalConfig(settings: SystemSettings): PayPalConfig {
  const environment = stringFrom(settings.paypalEnvironment).toLowerCase() === "sandbox" ? "sandbox" : "live";
  return {
    appName: stringFrom(settings.paypalAppName) || "irenee_institut",
    clientId: stringFrom(settings.paypalClientId),
    clientSecret: stringFrom(settings.paypalClientSecret),
    webhookId: stringFrom(settings.paypalWebhookId),
    webhookUrl: stringFrom(settings.paypalWebhookUrl) || PAYPAL_WEBHOOK_URL,
    environment
  };
}

export function getPayPalBaseUrl(environment: PayPalEnvironment) {
  return environment === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

export function parseEuroAmountToCents(value: unknown, fallbackCents = PAYPAL_DEFAULT_AMOUNT_CENTS) {
  const raw = stringFrom(value);
  const numeric = raw ? Number(raw.replace(",", ".").replace(/[^\d.]/g, "")) : fallbackCents / 100;
  const cents = Math.round(numeric * 100);

  if (!Number.isFinite(cents) || cents < PAYPAL_MIN_AMOUNT_CENTS) {
    throw new Error("Le montant PayPal doit etre d'au moins 1 euro.");
  }

  return cents;
}

export function parsePayPalValueToCents(value: unknown) {
  const numeric = Number(stringFrom(value).replace(",", "."));
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

export function centsToPayPalValue(cents: number) {
  return (Math.round(cents) / 100).toFixed(2);
}

export function buildPayPalOrderPayload({ amountCents, bookRequested, course, origin, profile }: PayPalOrderPayloadInput) {
  const amount = centsToPayPalValue(amountCents);
  const fullName = `${profile.prenom || ""} ${profile.nom || ""}`.trim();
  const customId = `${profile.id}:${course.id}`;
  const safeOrigin = origin.replace(/\/$/, "");

  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: trimForPayPal(course.id, 256),
        custom_id: trimForPayPal(customId, 127),
        description: trimForPayPal(`Formation ${course.titre}`, 127),
        amount: {
          currency_code: PAYPAL_CURRENCY,
          value: amount
        },
        soft_descriptor: "IRENEE INSTITUT"
      }
    ],
    payer: {
      email_address: profile.email,
      name: fullName
        ? {
          given_name: trimForPayPal(profile.prenom || fullName, 140),
          surname: trimForPayPal(profile.nom || ".", 140)
        }
        : undefined
    },
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          payment_method_selected: "PAYPAL",
          brand_name: "irenee_institut",
          landing_page: "LOGIN",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: `${safeOrigin}/paiement/merci?course=${encodeURIComponent(course.slug)}&book=${bookRequested ? "1" : "0"}`,
          cancel_url: `${safeOrigin}/formations?paypal_cancelled=1`
        }
      }
    }
  };
}

export async function generatePayPalAccessToken(config: PayPalConfig, fetcher: FetchLike = fetch) {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Les identifiants PayPal ne sont pas configures.");
  }

  const response = await fetcher(`${getPayPalBaseUrl(config.environment)}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.message || "PayPal n'a pas fourni de jeton d'acces.");
  }

  return String(data.access_token);
}

export async function createPayPalOrder({
  config,
  fetcher = fetch,
  input,
  requestId = crypto.randomUUID()
}: {
  config: PayPalConfig;
  fetcher?: FetchLike;
  input: PayPalOrderPayloadInput;
  requestId?: string;
}) {
  const accessToken = await generatePayPalAccessToken(config, fetcher);
  const response = await fetcher(`${getPayPalBaseUrl(config.environment)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId,
      Prefer: "return=representation"
    },
    body: JSON.stringify(buildPayPalOrderPayload(input))
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.id) {
    const detail = data?.details?.[0];
    throw new Error(detail?.description || detail?.issue || data?.message || "La commande PayPal n'a pas pu etre creee.");
  }

  return data;
}

export async function capturePayPalOrder({
  config,
  fetcher = fetch,
  orderId,
  requestId = crypto.randomUUID()
}: {
  config: PayPalConfig;
  fetcher?: FetchLike;
  orderId: string;
  requestId?: string;
}) {
  const accessToken = await generatePayPalAccessToken(config, fetcher);
  const response = await fetcher(`${getPayPalBaseUrl(config.environment)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId,
      Prefer: "return=representation"
    }
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.details?.[0];
    throw new Error(detail?.issue || detail?.description || data?.message || "La capture PayPal a echoue.");
  }

  return data;
}

export function extractCompletedCapture(capturePayload: unknown) {
  const payload = capturePayload as {
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          id?: string;
          status?: string;
          amount?: { currency_code?: string; value?: string };
        }>;
      };
    }>;
  };
  const captures = payload.purchase_units?.flatMap(unit => unit.payments?.captures || []) || [];
  const capture = captures.find(item => item.status === "COMPLETED") || captures[0];

  if (!capture?.id) return null;

  return {
    captureId: String(capture.id),
    status: String(capture.status || ""),
    amountCents: parsePayPalValueToCents(capture.amount?.value),
    currency: stringFrom(capture.amount?.currency_code) || PAYPAL_CURRENCY
  };
}

export function extractPayPalOrderIdFromWebhook(event: unknown) {
  const payload = event as {
    event_type?: string;
    resource?: {
      id?: string;
      supplementary_data?: {
        related_ids?: {
          order_id?: string;
        };
      };
      links?: Array<{ href?: string; rel?: string }>;
    };
  };
  const eventType = stringFrom(payload.event_type);
  const resource = payload.resource || {};

  if (eventType.startsWith("CHECKOUT.ORDER.")) return stringFrom(resource.id);

  const relatedOrderId = stringFrom(resource.supplementary_data?.related_ids?.order_id);
  if (relatedOrderId) return relatedOrderId;

  const orderLink = resource.links?.find(link => stringFrom(link.rel) === "up" || stringFrom(link.href).includes("/v2/checkout/orders/"));
  const match = stringFrom(orderLink?.href).match(/\/v2\/checkout\/orders\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function verifyPayPalWebhookSignature({
  config,
  event,
  fetcher = fetch,
  headers
}: {
  config: PayPalConfig;
  event: unknown;
  fetcher?: FetchLike;
  headers: Headers;
}) {
  if (!config.webhookId) {
    throw new Error("L'identifiant webhook PayPal n'est pas configure.");
  }

  const accessToken = await generatePayPalAccessToken(config, fetcher);
  const response = await fetcher(`${getPayPalBaseUrl(config.environment)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: config.webhookId,
      webhook_event: event
    })
  });
  const data = await response.json().catch(() => null);
  return response.ok && data?.verification_status === "SUCCESS";
}

export async function createPayPalWebhook({
  config,
  fetcher = fetch
}: {
  config: PayPalConfig;
  fetcher?: FetchLike;
}) {
  const accessToken = await generatePayPalAccessToken(config, fetcher);
  const response = await fetcher(`${getPayPalBaseUrl(config.environment)}/v1/notifications/webhooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: config.webhookUrl,
      event_types: PAYPAL_CHECKOUT_WEBHOOK_EVENTS.map(name => ({ name }))
    })
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.id) {
    const message = data?.details?.[0]?.description || data?.message || "Le webhook PayPal n'a pas pu etre cree.";
    throw new Error(message);
  }

  return data;
}
