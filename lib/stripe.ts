import { createHmac, timingSafeEqual } from "node:crypto";
import type { Course, Profile } from "@/lib/types";
import type { SystemSettings } from "@/lib/settings";

export const STRIPE_API_VERSION = "2022-11-15";
// Le paiement affiché sur le site utilise `ui_mode: custom`, refusé par les
// versions antérieures. Cette version ne s'applique qu'à la création de la
// session : les webhooks continuent d'arriver dans la version du compte, donc
// le règlement et les remboursements existants restent inchangés.
export const STRIPE_CUSTOM_UI_API_VERSION = "2025-03-31.basil";
export const STRIPE_CURRENCY = "EUR";
export const STRIPE_DEFAULT_AMOUNT_CENTS = 9900;
export const STRIPE_MIN_AMOUNT_CENTS = 100;
export const STRIPE_MAX_AMOUNT_CENTS = 100_000_000;
export const STRIPE_BOOK_TITLE_MAX_LENGTH = 180;
export const STRIPE_WEBHOOK_URL = "https://irenee-institut.org/stripe_webhook";
export const STRIPE_LITE_WEBHOOK_URL = "https://irenee-institut.org/stripe_webhook_lite";

export type StripeProductType = "annual_pass" | "library_membership" | "legacy_course";

// "hosted" redirige vers Stripe ; "custom" garde l'internaute sur le site et
// laisse l'habillage du formulaire à l'application.
export type StripeCheckoutUiMode = "hosted" | "custom";

export type StripeConfig = {
  apiVersion: string;
  liteWebhookSecret: string;
  liteWebhookUrl: string;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  webhookUrl: string;
};

export type StripeCheckoutSessionPayloadInput = {
  amountCents: number;
  bookRequested: boolean;
  bookTitle?: string;
  cancelPath?: string;
  course: Pick<Course, "id" | "slug" | "titre">;
  origin: string;
  productType: StripeProductType;
  profile: Pick<Profile, "id" | "email" | "prenom" | "nom">;
  returnPath?: string;
  uiMode?: StripeCheckoutUiMode;
};

type FetchLike = typeof fetch;

type StripeRelatedObject = {
  id?: string;
  type?: string;
  url?: string;
};

export type StripeCheckoutSessionSummary = {
  amountTotal: number;
  bookRequested: boolean;
  bookTitle: string;
  captureId: string;
  currency: string;
  eventId: string;
  eventType: string;
  metadata: Record<string, string>;
  paymentStatus: string;
  productType: StripeProductType;
  relatedObject?: StripeRelatedObject;
  sessionId: string;
  status: string;
  userId: string;
};

type PendingStripeOrder = {
  amount_total?: unknown;
  currency?: unknown;
  order_id?: unknown;
  product_type?: unknown;
  provider?: unknown;
  user_id?: unknown;
};

function stringFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function boolFrom(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = stringFrom(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function safePath(origin: string, path: string) {
  const safeOrigin = origin.replace(/\/$/, "");
  if (/^https?:\/\//i.test(path)) return path;
  return `${safeOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

function metadataFrom(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, stringFrom(item)])
  );
}

function productTypeFrom(value: unknown): StripeProductType {
  const normalized = stringFrom(value);
  if (normalized === "library_membership" || normalized === "legacy_course") return normalized;
  return "annual_pass";
}

export function isExpectedPaidStripeSession(
  summary: StripeCheckoutSessionSummary,
  order: PendingStripeOrder | null | undefined
) {
  return summary.paymentStatus === "paid" && isExpectedStripeSession(summary, order);
}

export function isExpectedStripeSession(
  summary: StripeCheckoutSessionSummary,
  order: PendingStripeOrder | null | undefined
) {
  if (!order) return false;
  const expectedAmount = Number(order.amount_total);
  if (!Number.isSafeInteger(summary.amountTotal) || summary.amountTotal <= 0 || !Number.isSafeInteger(expectedAmount)) return false;
  return summary.sessionId === stringFrom(order.order_id)
    && summary.amountTotal === expectedAmount
    && summary.currency.toUpperCase() === stringFrom(order.currency).toUpperCase()
    && summary.userId !== ""
    && summary.userId === stringFrom(order.user_id)
    && summary.productType === productTypeFrom(order.product_type)
    && stringFrom(order.provider).toLowerCase() === "stripe";
}

export function parseStripeAmountToCents(value: unknown, fallbackCents = STRIPE_DEFAULT_AMOUNT_CENTS) {
  const raw = stringFrom(value);
  if (raw && !/^\d{1,7}(?:[.,]\d{1,2})?$/.test(raw)) {
    throw new Error("Le montant Stripe est invalide.");
  }
  const numeric = raw ? Number(raw.replace(",", ".")) : fallbackCents / 100;
  const cents = Math.round(numeric * 100);

  if (!Number.isSafeInteger(cents) || cents < STRIPE_MIN_AMOUNT_CENTS) {
    throw new Error("Le montant Stripe doit etre d'au moins 1 euro.");
  }
  if (cents > STRIPE_MAX_AMOUNT_CENTS) throw new Error("Le montant Stripe dépasse le maximum autorisé.");

  return cents;
}

export function normalizeStripeBookTitle(value: unknown, required = false) {
  const title = stringFrom(value).replace(/\s+/g, " ");
  if (required && !title) {
    throw new Error("Indiquez le titre du livre souhaite.");
  }
  return title.length > STRIPE_BOOK_TITLE_MAX_LENGTH ? title.slice(0, STRIPE_BOOK_TITLE_MAX_LENGTH) : title;
}

export function getStripeConfig(settings: SystemSettings): StripeConfig {
  return {
    apiVersion: stringFrom(settings.stripeApiVersion || process.env.STRIPE_API_VERSION) || STRIPE_API_VERSION,
    liteWebhookSecret: stringFrom(settings.stripeLiteWebhookSecret || process.env.STRIPE_WEBHOOK_LITE_SECRET),
    liteWebhookUrl: stringFrom(settings.stripeLiteWebhookUrl || process.env.STRIPE_WEBHOOK_LITE_URL) || STRIPE_LITE_WEBHOOK_URL,
    publishableKey: stringFrom(settings.stripePublishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY),
    secretKey: stringFrom(settings.stripeSecretKey || process.env.STRIPE_SECRET_KEY),
    webhookSecret: stringFrom(settings.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET),
    webhookUrl: stringFrom(settings.stripeWebhookUrl || process.env.STRIPE_WEBHOOK_URL) || STRIPE_WEBHOOK_URL
  };
}

// Webhook signing secrets are independent from API key mode. A valid
// signature alone must never let a test event change production entitlements.
export function isExpectedStripeEventMode(event: unknown, secretKey: string) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return false;
  const mode = /^(?:sk|rk)_(live|test)_/.exec(secretKey)?.[1];
  if (!mode) return false;
  const payload = event as { livemode?: unknown; data?: { object?: { livemode?: unknown } } };
  const expected = mode === "live";
  return payload.livemode === expected
    && (payload.data?.object?.livemode === undefined || payload.data.object.livemode === expected);
}

export function buildStripeCheckoutSessionParams(input: StripeCheckoutSessionPayloadInput) {
  const params = new URLSearchParams();
  const bookTitle = normalizeStripeBookTitle(input.bookTitle || "", input.bookRequested);
  const successPath = input.returnPath || "/paiement/merci?stripe_session_id={CHECKOUT_SESSION_ID}";
  const cancelPath = input.cancelPath || "/formations?stripe_cancelled=1";
  const fullName = `${input.profile.prenom || ""} ${input.profile.nom || ""}`.trim();
  const metadata = {
    book_requested: input.bookRequested ? "true" : "false",
    book_title: bookTitle,
    course_id: input.course.id,
    course_slug: input.course.slug,
    product_type: input.productType,
    user_id: input.profile.id
  };

  params.set("mode", "payment");
  params.set("locale", "fr");
  if (input.uiMode === "custom") {
    // Le formulaire vit sur le site ; Stripe ne sert que de tunnel de paiement
    // et ne reprend la main que pour l'authentification bancaire éventuelle.
    params.set("ui_mode", "custom");
    params.set("return_url", safePath(input.origin, successPath));
  } else {
    params.set("success_url", safePath(input.origin, successPath));
    params.set("cancel_url", safePath(input.origin, cancelPath));
  }
  params.set("client_reference_id", input.profile.id);
  params.set("payment_method_types[0]", "card");
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", STRIPE_CURRENCY.toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(Math.round(input.amountCents)));
  params.set("line_items[0][price_data][product_data][name]", input.course.titre);
  params.set("line_items[0][price_data][product_data][description]", `Acces ${input.course.titre}`);
  params.set("payment_intent_data[description]", fullName ? `${input.course.titre} - ${fullName}` : input.course.titre);
  if (input.profile.email) params.set("customer_email", input.profile.email);

  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, value);
    params.set(`payment_intent_data[metadata][${key}]`, value);
  }

  return params;
}

export async function createStripeCheckoutSession({
  config,
  fetcher = fetch,
  input,
  requestId = crypto.randomUUID()
}: {
  config: StripeConfig;
  fetcher?: FetchLike;
  input: StripeCheckoutSessionPayloadInput;
  requestId?: string;
}) {
  if (!config.secretKey) {
    throw new Error("La cle secrete Stripe n'est pas configuree.");
  }

  const isCustomUi = input.uiMode === "custom";
  const response = await fetcher("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": requestId,
      "Stripe-Version": isCustomUi
        ? STRIPE_CUSTOM_UI_API_VERSION
        : config.apiVersion || STRIPE_API_VERSION
    },
    body: buildStripeCheckoutSessionParams(input)
  });
  const data = await response.json().catch(() => null);

  // Une session affichée sur le site expose un `client_secret` au lieu d'une URL.
  const missingHandle = isCustomUi ? !data?.client_secret : !data?.url;
  if (!response.ok || !data?.id || missingHandle) {
    const message = data?.error?.message || data?.message || "La session Stripe n'a pas pu etre creee.";
    throw new Error(message);
  }

  return data;
}

export async function retrieveStripeObject({
  config,
  fetcher = fetch,
  url
}: {
  config: StripeConfig;
  fetcher?: FetchLike;
  url: string;
}) {
  if (!config.secretKey) {
    throw new Error("La cle secrete Stripe n'est pas configuree.");
  }

  const path = stringFrom(url);
  if (!path.startsWith("/v1/")) {
    throw new Error("Objet Stripe leger non recuperable.");
  }

  const response = await fetcher(`https://api.stripe.com${path}`, {
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Stripe-Version": config.apiVersion || STRIPE_API_VERSION
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    throw new Error(data?.error?.message || "L'objet Stripe n'a pas pu etre recupere.");
  }
  return data;
}

export function verifyStripeWebhookSignature({
  now = Math.floor(Date.now() / 1000),
  rawBody,
  secret,
  signature,
  toleranceSeconds = 300
}: {
  now?: number;
  rawBody: string;
  secret: string;
  signature: string | null;
  toleranceSeconds?: number;
}) {
  const endpointSecret = stringFrom(secret);
  if (!endpointSecret || !signature) return false;

  const pieces = Object.fromEntries(
    signature.split(",").map(part => {
      const [key, ...rest] = part.split("=");
      return [key, rest.join("=")];
    })
  );
  const timestamp = Number(pieces.t);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", endpointSecret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const provided = signature
    .split(",")
    .filter(part => part.startsWith("v1="))
    .map(part => Buffer.from(part.slice(3), "hex"));

  return provided.some(candidate => {
    if (candidate.length !== expectedBuffer.length) return false;
    return timingSafeEqual(candidate, expectedBuffer);
  });
}

export function extractStripeCheckoutSessionSummary(eventOrSession: unknown): StripeCheckoutSessionSummary {
  const payload = (eventOrSession || {}) as {
    data?: { object?: unknown };
    id?: string;
    object?: string;
    related_object?: StripeRelatedObject;
    type?: string;
  };
  const eventId = payload.object === "event" || payload.object === "v2.core.event" ? stringFrom(payload.id) : "";
  const eventType = stringFrom(payload.type);
  const session = ((payload.data?.object as Record<string, unknown> | undefined) ||
    (payload.object === "checkout.session" ? payload as Record<string, unknown> : null));
  const metadata = metadataFrom(session?.metadata);
  const paymentIntent = session?.payment_intent as string | { id?: string } | undefined;
  const captureId = typeof paymentIntent === "string" ? paymentIntent : stringFrom(paymentIntent?.id);

  return {
    amountTotal: Number(session?.amount_total || 0),
    bookRequested: boolFrom(metadata.book_requested),
    bookTitle: metadata.book_title || "",
    captureId: captureId || stringFrom(session?.id),
    currency: stringFrom(session?.currency).toUpperCase() || STRIPE_CURRENCY,
    eventId,
    eventType,
    metadata,
    paymentStatus: stringFrom(session?.payment_status),
    productType: productTypeFrom(metadata.product_type),
    relatedObject: payload.related_object,
    sessionId: stringFrom(session?.id),
    status: stringFrom(session?.status),
    userId: metadata.user_id || stringFrom(session?.client_reference_id)
  };
}
