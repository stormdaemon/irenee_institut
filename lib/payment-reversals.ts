import { parsePayPalValueToCents } from "./paypal";

export type PaymentReversalKind = "denied" | "disputed" | "refunded" | "reversed";

export type PaymentReversal = {
  amountTotal: number;
  captureId: string;
  currency: string;
  eventId: string;
  eventName: string;
  kind: PaymentReversalKind;
  objectId: string;
  orderId: string;
};

const providerIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/;

function stringFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function providerIdentifier(value: unknown) {
  const identifier = stringFrom(value);
  return providerIdentifierPattern.test(identifier) ? identifier : "";
}

function positiveCents(value: unknown) {
  const amount = Number(value || 0);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

function relatedIdentifier(value: unknown) {
  if (typeof value === "string") return providerIdentifier(value);
  if (!value || typeof value !== "object") return "";
  return providerIdentifier((value as { id?: unknown }).id);
}

export function extractStripeReversal(event: unknown): PaymentReversal | null {
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;
  const payload = event as {
    data?: { object?: Record<string, unknown> };
    id?: unknown;
    type?: unknown;
  };
  const eventId = providerIdentifier(payload.id);
  const eventName = stringFrom(payload.type);
  const resource = payload.data?.object;
  if (!eventId || !resource) return null;

  let kind: PaymentReversalKind;
  let amountTotal = 0;
  if (eventName === "charge.refunded") {
    kind = "refunded";
    amountTotal = positiveCents(resource.amount_refunded);
  } else if (
    eventName === "charge.dispute.created"
    || eventName === "charge.dispute.funds_withdrawn"
    || (eventName === "charge.dispute.closed" && stringFrom(resource.status).toLowerCase() === "lost")
  ) {
    kind = "disputed";
    amountTotal = positiveCents(resource.amount);
  } else {
    return null;
  }

  const metadata = resource.metadata && typeof resource.metadata === "object"
    ? resource.metadata as Record<string, unknown>
    : {};
  const objectId = providerIdentifier(resource.id);
  const captureId = relatedIdentifier(resource.payment_intent)
    || relatedIdentifier(resource.charge);
  const orderId = providerIdentifier(metadata.checkout_session_id)
    || providerIdentifier(metadata.order_id);
  if (!objectId || (!captureId && !orderId)) return null;

  return {
    amountTotal,
    captureId,
    currency: stringFrom(resource.currency).toUpperCase().slice(0, 3),
    eventId,
    eventName,
    kind,
    objectId,
    orderId
  };
}

export function extractPayPalReversal(event: unknown): PaymentReversal | null {
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;
  const payload = event as {
    event_type?: unknown;
    id?: unknown;
    resource?: {
      amount?: { currency_code?: unknown; value?: unknown };
      dispute_amount?: { currency_code?: unknown; value?: unknown };
      dispute_id?: unknown;
      disputed_transactions?: Array<{
        seller_transaction_id?: unknown;
        transaction_info?: { seller_transaction_id?: unknown };
      }>;
      id?: unknown;
      supplementary_data?: {
        related_ids?: { capture_id?: unknown; order_id?: unknown };
      };
    };
  };
  const eventId = providerIdentifier(payload.id);
  const eventName = stringFrom(payload.event_type);
  const resource = payload.resource;
  if (!eventId || !resource) return null;

  if (eventName === "CUSTOMER.DISPUTE.CREATED") {
    const transaction = resource.disputed_transactions?.find(item => providerIdentifier(
      item?.seller_transaction_id || item?.transaction_info?.seller_transaction_id
    ));
    const captureId = providerIdentifier(
      transaction?.seller_transaction_id || transaction?.transaction_info?.seller_transaction_id
    );
    const objectId = providerIdentifier(resource.dispute_id || resource.id);
    if (!captureId || !objectId) return null;
    return {
      amountTotal: parsePayPalValueToCents(resource.dispute_amount?.value),
      captureId,
      currency: stringFrom(resource.dispute_amount?.currency_code).toUpperCase().slice(0, 3),
      eventId,
      eventName,
      kind: "disputed",
      objectId,
      orderId: ""
    };
  }

  const kindByEvent: Record<string, PaymentReversalKind> = {
    "CHECKOUT.PAYMENT-APPROVAL.REVERSED": "reversed",
    "PAYMENT.CAPTURE.DENIED": "denied",
    "PAYMENT.CAPTURE.REFUNDED": "refunded",
    "PAYMENT.CAPTURE.REVERSED": "reversed"
  };
  const kind = kindByEvent[eventName];
  if (!kind) return null;

  const relatedIds = resource.supplementary_data?.related_ids;
  const objectId = providerIdentifier(resource.id);
  const orderId = providerIdentifier(relatedIds?.order_id)
    || (eventName.startsWith("CHECKOUT.") ? objectId : "");
  const captureId = providerIdentifier(relatedIds?.capture_id)
    || (eventName.startsWith("PAYMENT.CAPTURE.") && kind !== "refunded" ? objectId : "");
  if (!objectId || (!captureId && !orderId)) return null;

  return {
    amountTotal: parsePayPalValueToCents(resource.amount?.value),
    captureId,
    currency: stringFrom(resource.amount?.currency_code).toUpperCase().slice(0, 3),
    eventId,
    eventName,
    kind,
    objectId,
    orderId
  };
}

export function validatePayPalWebhookHeaders(headers: Headers): { ok: true } | { ok: false; reason: string } {
  const algorithm = stringFrom(headers.get("paypal-auth-algo"));
  const certUrlValue = stringFrom(headers.get("paypal-cert-url"));
  const transmissionId = providerIdentifier(headers.get("paypal-transmission-id"));
  const transmissionSignature = stringFrom(headers.get("paypal-transmission-sig"));
  const transmissionTime = stringFrom(headers.get("paypal-transmission-time"));

  if (!/^SHA256withRSA$/i.test(algorithm)) return { ok: false, reason: "algorithm" };
  if (!transmissionId) return { ok: false, reason: "transmission_id" };
  if (!/^[A-Za-z0-9+/=_-]{4,2048}$/.test(transmissionSignature)) return { ok: false, reason: "signature" };
  if (transmissionTime.length > 64 || !Number.isFinite(Date.parse(transmissionTime))) return { ok: false, reason: "time" };

  try {
    const certUrl = new URL(certUrlValue);
    const trustedHost = certUrl.hostname === "paypal.com" || certUrl.hostname.endsWith(".paypal.com");
    if (certUrl.protocol !== "https:" || certUrl.username || certUrl.password || !trustedHost || certUrl.port) {
      return { ok: false, reason: "certificate_url" };
    }
  } catch {
    return { ok: false, reason: "certificate_url" };
  }

  return { ok: true };
}

export function validateStripeWebhookHeader(value: string | null) {
  const header = stringFrom(value);
  if (!header || header.length > 2048) return false;
  const parts = header.split(",").map(part => part.trim());
  const timestamp = parts.find(part => part.startsWith("t="))?.slice(2) || "";
  const signatures = parts.filter(part => part.startsWith("v1=")).map(part => part.slice(3));
  return /^\d{10,}$/.test(timestamp) && signatures.some(signature => /^[0-9a-f]{64}$/i.test(signature));
}
