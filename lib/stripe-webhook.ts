import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/settings";
import {
  extractStripeCheckoutSessionSummary,
  getStripeConfig,
  isExpectedPaidStripeSession,
  retrieveStripeObject,
  STRIPE_CURRENCY,
  verifyStripeWebhookSignature,
  type StripeCheckoutSessionSummary,
  type StripeConfig,
  type StripeProductType
} from "@/lib/stripe";
import type { createServerClient } from "@/lib/supabase";
import { RequestBodyTooLargeError, readTextBodyWithLimit } from "@/lib/webhook-security";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractStripeReversal, validateStripeWebhookHeader } from "@/lib/payment-reversals";
import { getTrustedClientIp } from "@/lib/request-security";
import { recordSecurityEvent } from "@/lib/security-audit";

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>;

const checkoutCompletionEvents = new Set([
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed"
]);

function stringFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function productTypeFrom(value: unknown): StripeProductType {
  const normalized = stringFrom(value);
  if (normalized === "library_membership" || normalized === "legacy_course") return normalized;
  return "annual_pass";
}

function isCheckoutCompletionEvent(type: string) {
  return checkoutCompletionEvents.has(type);
}

async function logStripeWebhook(
  supabase: ServerClient,
  status: string,
  summary: Partial<StripeCheckoutSessionSummary>
) {
  const eventId = stringFrom(summary.eventId).slice(0, 255);
  if (!eventId) return;
  await supabase.from("payment_events").upsert({
    provider: "stripe",
    provider_event_id: eventId,
    event_name: stringFrom(summary.eventType).slice(0, 200) || "stripe_webhook",
    order_id: stringFrom(summary.sessionId).slice(0, 255) || null,
    amount_total: Number.isSafeInteger(summary.amountTotal) && Number(summary.amountTotal) > 0 ? summary.amountTotal : null,
    currency: stringFrom(summary.currency) || STRIPE_CURRENCY,
    status
  }, { onConflict: "provider,provider_event_id" });
}

async function resolveSessionSummary(config: StripeConfig, event: unknown) {
  const initial = extractStripeCheckoutSessionSummary(event);
  if (initial.sessionId || initial.relatedObject?.type !== "checkout.session") {
    return initial;
  }

  const url = initial.relatedObject.url || `/v1/checkout/sessions/${encodeURIComponent(stringFrom(initial.relatedObject.id))}`;
  const session = await retrieveStripeObject({ config, url });
  const hydrated = extractStripeCheckoutSessionSummary(session);

  return {
    ...hydrated,
    eventId: initial.eventId,
    eventType: initial.eventType,
    relatedObject: initial.relatedObject
  };
}

async function validatePaidStripeSession({
  summary,
  supabase
}: {
  summary: StripeCheckoutSessionSummary;
  supabase: ServerClient;
}) {
  const { data: orderRow, error: orderError } = await supabase
    .from("paypal_orders")
    .select("*")
    .eq("order_id", summary.sessionId)
    .maybeSingle();

  if (orderError) throw new Error("order_lookup_failed");
  if (!orderRow) {
    await logStripeWebhook(supabase, "order_not_found", summary).catch(() => undefined);
    return { ok: false as const, reason: "order_not_found" as const };
  }
  if (!isExpectedPaidStripeSession(summary, orderRow)) {
    await logStripeWebhook(supabase, "payment_mismatch", summary).catch(() => undefined);
    return { ok: false as const, reason: "payment_mismatch" as const };
  }
  if (["completed", "partially_refunded", "refunded", "reversed", "denied", "disputed"].includes(stringFrom(orderRow.status).toLowerCase())) {
    await logStripeWebhook(supabase, "already_settled", summary).catch(() => undefined);
    return { ok: true as const, alreadySettled: true as const, data: null };
  }

  const productType = productTypeFrom(orderRow.product_type);
  const userId = stringFrom(orderRow.user_id);
  const courseId = productType === "legacy_course" ? stringFrom(orderRow.course_id) || null : null;
  const amountTotal = summary.amountTotal;
  const currency = summary.currency;
  const bookRequested = Boolean(orderRow.book_requested);
  const bookTitle = stringFrom(orderRow.book_title);
  const captureId = summary.captureId || summary.sessionId;

  const { data, error } = await supabase.rpc("validate_payment", {
    p_amount_total: amountTotal,
    p_book_requested: bookRequested,
    p_book_title: bookTitle,
    p_capture_id: captureId,
    p_course_id: courseId,
    p_currency: currency,
    p_event_name: summary.eventType || "stripe_checkout_completed",
    p_order_id: summary.sessionId,
    p_product_type: productType,
    p_provider: "stripe",
    p_raw_payload: null,
    p_user_id: userId
  });

  if (error) throw new Error("payment_validation_failed");
  return { ok: true as const, data };
}

export async function handleStripeWebhookRequest({
  lite,
  request,
  supabase
}: {
  lite: boolean;
  request: Request;
  supabase: ServerClient;
}) {
  let rawBody: string;
  try {
    rawBody = await readTextBodyWithLimit(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Payload Stripe illisible." }, { status: 400 });
  }
  let event: unknown;
  let authenticated = false;

  try {
    event = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ ok: false, error: "Payload Stripe invalide." }, { status: 400 });
  }

  if (!validateStripeWebhookHeader(request.headers.get("stripe-signature"))) {
    return NextResponse.json({ ok: false, error: "Signature Stripe invalide." }, { status: 401 });
  }

  try {
    const clientIp = getTrustedClientIp(request);
    const limit = await checkRateLimit(`webhook:stripe:ip:${clientIp}`, 300, 60_000);
    if (!limit.allowed) {
      await recordSecurityEvent({ eventType: "payment.webhook.rate_limited", metadata: { reason: "stripe" }, request });
      return NextResponse.json({ ok: false, error: "Trop de requêtes webhook." }, {
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
        status: 429
      });
    }

    const settings = await getSystemSettings(supabase);
    const config = getStripeConfig(settings);
    const secret = lite ? config.liteWebhookSecret : config.webhookSecret;

    if (!secret) {
      await recordSecurityEvent({ eventType: "payment.webhook.configuration_error", metadata: { reason: "stripe_secret" }, request });
      return NextResponse.json({ ok: false, error: "Secret webhook Stripe non configure." }, { status: 501 });
    }

    const verified = verifyStripeWebhookSignature({
      rawBody,
      secret,
      signature: request.headers.get("stripe-signature")
    });

    if (!verified) {
      await recordSecurityEvent({ eventType: "payment.webhook.signature_rejected", metadata: { reason: "stripe" }, request });
      return NextResponse.json({ ok: false, error: "Signature Stripe invalide." }, { status: 401 });
    }
    authenticated = true;

    const reversal = extractStripeReversal(event);
    if (reversal) {
      const { data, error } = await supabase.rpc("process_payment_reversal", {
        p_amount_total: reversal.amountTotal,
        p_capture_id: reversal.captureId,
        p_currency: reversal.currency,
        p_event_name: reversal.eventName,
        p_kind: reversal.kind,
        p_object_id: reversal.objectId,
        p_order_id: reversal.orderId,
        p_provider: "stripe",
        p_provider_event_id: reversal.eventId
      });
      if (error) throw new Error("payment_reversal_failed");
      if (!(data as { ok?: boolean } | null)?.ok) {
        return NextResponse.json({ ok: false, error: "La commande Stripe liée au litige est introuvable." }, { status: 409 });
      }
      return NextResponse.json({ ok: true, reversal: data });
    }

    const initial = extractStripeCheckoutSessionSummary(event);
    if (!initial.eventId) {
      return NextResponse.json({ ok: false, error: "Identifiant d'événement Stripe manquant." }, { status: 400 });
    }
    if (!isCheckoutCompletionEvent(initial.eventType)) {
      await logStripeWebhook(supabase, "ignored", initial).catch(() => undefined);
      return NextResponse.json({ ok: true, ignored: initial.eventType || "unknown" });
    }

    if (!initial.sessionId && initial.relatedObject?.type === "checkout.session") {
      const relatedSessionId = stringFrom(initial.relatedObject.id);
      const { data: expectedOrder, error: orderError } = relatedSessionId
        ? await supabase
          .from("paypal_orders")
          .select("order_id")
          .eq("provider", "stripe")
          .eq("order_id", relatedSessionId)
          .maybeSingle()
        : { data: null, error: null };
      if (orderError) throw new Error("order_lookup_failed");
      if (!expectedOrder) {
        await logStripeWebhook(supabase, "order_not_found", { ...initial, sessionId: relatedSessionId }).catch(() => undefined);
        return NextResponse.json({ ok: false, error: "Commande Stripe inconnue." }, { status: 409 });
      }
    }

    const summary = await resolveSessionSummary(config, event);
    if (!summary.sessionId) {
      await logStripeWebhook(supabase, "missing_checkout_session", summary).catch(() => undefined);
      return NextResponse.json({ ok: true, missingSession: true });
    }

    if (summary.paymentStatus !== "paid") {
      try {
        await supabase
          .from("paypal_orders")
          .update({
            status: summary.paymentStatus || summary.status || "pending",
            updated_at: new Date().toISOString()
          })
          .eq("order_id", summary.sessionId);
      } catch {
        // The webhook response should not fail only because a pending status could not be mirrored.
      }
      await logStripeWebhook(supabase, summary.paymentStatus || "not_paid", summary).catch(() => undefined);
      return NextResponse.json({ ok: true, pending: true });
    }

    const result = await validatePaidStripeSession({ summary, supabase });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "La confirmation Stripe ne correspond pas à la commande enregistrée." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, validated: true, data: result.data || null });
  } catch (error) {
    if (authenticated) {
      const summary = extractStripeCheckoutSessionSummary(event);
      await logStripeWebhook(supabase, "processing_error", summary).catch(() => undefined);
      await recordSecurityEvent({ eventType: "payment.webhook.processing_error", metadata: { reason: "stripe" }, request });
    }
    return NextResponse.json({
      ok: false,
      error: "Webhook Stripe impossible à traiter."
    }, { status: 500 });
  }
}
