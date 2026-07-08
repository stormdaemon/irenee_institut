import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/settings";
import {
  extractStripeCheckoutSessionSummary,
  getStripeConfig,
  retrieveStripeObject,
  STRIPE_CURRENCY,
  verifyStripeWebhookSignature,
  type StripeCheckoutSessionSummary,
  type StripeConfig,
  type StripeProductType
} from "@/lib/stripe";
import type { createServerClient } from "@/lib/supabase";

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>;

const checkoutCompletionEvents = new Set([
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed"
]);

function stringFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function boolFrom(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = stringFrom(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function productTypeFrom(value: unknown): StripeProductType {
  const normalized = stringFrom(value);
  if (normalized === "library_membership" || normalized === "legacy_course") return normalized;
  return "annual_pass";
}

function isCheckoutCompletionEvent(type: string) {
  if (checkoutCompletionEvents.has(type)) return true;
  return [...checkoutCompletionEvents].some(eventName => type.endsWith(`.${eventName}`));
}

function webhookEventId(event: unknown, summary?: Partial<StripeCheckoutSessionSummary>) {
  const payload = event as { id?: string; type?: string };
  return stringFrom(payload.id) || summary?.eventId || `${summary?.eventType || stringFrom(payload.type) || "stripe"}-${Date.now()}`;
}

async function logStripeWebhook(
  supabase: ServerClient,
  event: unknown,
  status: string,
  summary?: Partial<StripeCheckoutSessionSummary>
) {
  await supabase.from("payment_events").upsert({
    provider: "stripe",
    provider_event_id: webhookEventId(event, summary),
    event_name: summary?.eventType || stringFrom((event as { type?: string }).type) || "stripe_webhook",
    order_id: summary?.sessionId || null,
    amount_total: summary?.amountTotal || null,
    currency: summary?.currency || STRIPE_CURRENCY,
    status,
    raw_payload: event
  }, { onConflict: "provider,provider_event_id" });
}

async function resolveSessionSummary(config: StripeConfig, event: unknown) {
  const initial = extractStripeCheckoutSessionSummary(event);
  if (initial.sessionId || initial.relatedObject?.type !== "checkout.session") {
    return { payload: event, summary: initial };
  }

  const url = initial.relatedObject.url || `/v1/checkout/sessions/${encodeURIComponent(stringFrom(initial.relatedObject.id))}`;
  const session = await retrieveStripeObject({ config, url });
  const hydrated = extractStripeCheckoutSessionSummary(session);

  return {
    payload: {
      event,
      related_object_payload: session
    },
    summary: {
      ...hydrated,
      eventId: initial.eventId,
      eventType: initial.eventType,
      relatedObject: initial.relatedObject
    }
  };
}

async function validatePaidStripeSession({
  eventPayload,
  summary,
  supabase
}: {
  eventPayload: unknown;
  summary: StripeCheckoutSessionSummary;
  supabase: ServerClient;
}) {
  const { data: orderRow, error: orderError } = await supabase
    .from("paypal_orders")
    .select("*")
    .eq("order_id", summary.sessionId)
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);

  const productType = productTypeFrom(orderRow?.product_type || summary.productType);
  const userId = stringFrom(orderRow?.user_id || summary.userId);
  const courseId = productType === "legacy_course" ? stringFrom(orderRow?.course_id || summary.metadata.course_id) || null : null;
  const amountTotal = summary.amountTotal || Number(orderRow?.amount_total || 0);
  const currency = summary.currency || stringFrom(orderRow?.currency) || STRIPE_CURRENCY;
  const bookRequested = Boolean(orderRow ? orderRow.book_requested : summary.bookRequested);
  const bookTitle = stringFrom(orderRow?.book_title || summary.bookTitle);
  const captureId = summary.captureId || summary.sessionId;

  if (!userId) {
    await logStripeWebhook(supabase, eventPayload, "missing_user_metadata", summary).catch(() => undefined);
    return { ok: true, missingUser: true };
  }

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
    p_raw_payload: eventPayload,
    p_user_id: userId
  });

  if (error) throw new Error(error.message);
  return { ok: true, data };
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
  const rawBody = await request.text();
  let event: unknown;

  try {
    event = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ ok: false, error: "Payload Stripe invalide." }, { status: 400 });
  }

  try {
    const settings = await getSystemSettings(supabase);
    const config = getStripeConfig(settings);
    const secret = lite ? config.liteWebhookSecret : config.webhookSecret;

    if (!secret) {
      await logStripeWebhook(supabase, event, "missing_webhook_secret").catch(() => undefined);
      return NextResponse.json({ ok: false, error: "Secret webhook Stripe non configure." }, { status: 501 });
    }

    const verified = verifyStripeWebhookSignature({
      rawBody,
      secret,
      signature: request.headers.get("stripe-signature")
    });

    if (!verified) {
      const summary = extractStripeCheckoutSessionSummary(event);
      await logStripeWebhook(supabase, event, "invalid_signature", summary).catch(() => undefined);
      return NextResponse.json({ ok: false, error: "Signature Stripe invalide." }, { status: 401 });
    }

    const initial = extractStripeCheckoutSessionSummary(event);
    if (!isCheckoutCompletionEvent(initial.eventType)) {
      await logStripeWebhook(supabase, event, "ignored", initial).catch(() => undefined);
      return NextResponse.json({ ok: true, ignored: initial.eventType || "unknown" });
    }

    const { payload, summary } = await resolveSessionSummary(config, event);
    if (!summary.sessionId) {
      await logStripeWebhook(supabase, payload, "missing_checkout_session", summary).catch(() => undefined);
      return NextResponse.json({ ok: true, missingSession: true });
    }

    if (summary.paymentStatus !== "paid") {
      try {
        await supabase
          .from("paypal_orders")
          .update({
            raw_capture: payload,
            status: summary.paymentStatus || summary.status || "pending",
            updated_at: new Date().toISOString()
          })
          .eq("order_id", summary.sessionId);
      } catch {
        // The webhook response should not fail only because a pending status could not be mirrored.
      }
      await logStripeWebhook(supabase, payload, summary.paymentStatus || "not_paid", summary).catch(() => undefined);
      return NextResponse.json({ ok: true, pending: true });
    }

    const result = await validatePaidStripeSession({ eventPayload: payload, summary, supabase });
    return NextResponse.json({ ok: true, validated: true, data: result.data || null });
  } catch (error) {
    const summary = extractStripeCheckoutSessionSummary(event);
    await logStripeWebhook(supabase, event, "processing_error", summary).catch(() => undefined);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Webhook Stripe impossible a traiter."
    }, { status: 500 });
  }
}
