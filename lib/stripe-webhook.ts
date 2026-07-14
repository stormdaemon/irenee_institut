import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/settings";
import {
  extractStripeCheckoutSessionSummary,
  getStripeConfig,
  retrieveStripeObject,
  STRIPE_CURRENCY,
  verifyStripeWebhookSignature,
  type StripeCheckoutSessionSummary,
  type StripeConfig
} from "@/lib/stripe";
import {
  findStripeOrder,
  isSettledStripeOrderStatus,
  settlePaidStripeSession,
  stripeCheckoutFailureStatus
} from "@/lib/stripe-settlement";
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

const checkoutFailureEvents = new Set([
  "checkout.session.async_payment_failed",
  "checkout.session.expired"
]);

function stringFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function isCheckoutCompletionEvent(type: string) {
  return checkoutCompletionEvents.has(type);
}

function isCheckoutFailureEvent(type: string) {
  return checkoutFailureEvents.has(type);
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
    if (!isCheckoutCompletionEvent(initial.eventType) && !isCheckoutFailureEvent(initial.eventType)) {
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

    if (isCheckoutFailureEvent(summary.eventType)) {
      const order = await findStripeOrder({ sessionId: summary.sessionId, supabase });
      if (!order) {
        await logStripeWebhook(supabase, "order_not_found", summary).catch(() => undefined);
        return NextResponse.json({ ok: false, error: "Commande Stripe inconnue." }, { status: 409 });
      }

      if (isSettledStripeOrderStatus(order.status)) {
        const currentStatus = stringFrom(order.status).toLowerCase();
        await logStripeWebhook(supabase, `ignored_after_${currentStatus}`, summary);
        return NextResponse.json({ ok: true, ignored: summary.eventType, status: currentStatus });
      }

      const failureStatus = stripeCheckoutFailureStatus(summary.eventType);
      if (!failureStatus) throw new Error("unsupported_checkout_failure");
      const failureUpdate = failureStatus === "expired"
        ? { status: "expired", updated_at: new Date().toISOString() }
        : { status: "failed", updated_at: new Date().toISOString() };
      const previousStatus = stringFrom(order.status).toLowerCase();
      const { data: updatedOrder, error: updateError } = await supabase
        .from("paypal_orders")
        .update(failureUpdate)
        .eq("provider", "stripe")
        .eq("order_id", summary.sessionId)
        .eq("status", previousStatus)
        .select("status")
        .maybeSingle();
      if (updateError) throw new Error("order_status_update_failed");
      if (!updatedOrder) {
        const latestOrder = await findStripeOrder({ sessionId: summary.sessionId, supabase });
        const latestStatus = stringFrom(latestOrder?.status).toLowerCase() || "changed";
        await logStripeWebhook(supabase, `ignored_after_${latestStatus}`, summary);
        return NextResponse.json({ ok: true, ignored: summary.eventType, status: latestStatus });
      }

      await logStripeWebhook(supabase, failureStatus, summary);
      return NextResponse.json({ ok: true, failed: true, status: failureStatus });
    }

    if (summary.paymentStatus !== "paid") {
      const order = await findStripeOrder({ sessionId: summary.sessionId, supabase });
      if (!order) {
        await logStripeWebhook(supabase, "order_not_found", summary).catch(() => undefined);
        return NextResponse.json({ ok: false, error: "Commande Stripe inconnue." }, { status: 409 });
      }
      if (isSettledStripeOrderStatus(order.status)) {
        const currentStatus = stringFrom(order.status).toLowerCase();
        await logStripeWebhook(supabase, `ignored_after_${currentStatus}`, summary);
        return NextResponse.json({ ok: true, ignored: summary.eventType, status: currentStatus });
      }
      const previousStatus = stringFrom(order.status).toLowerCase();
      const { data: updatedOrder, error: updateError } = await supabase
        .from("paypal_orders")
        .update({
          status: summary.paymentStatus || summary.status || "pending",
          updated_at: new Date().toISOString()
        })
        .eq("provider", "stripe")
        .eq("order_id", summary.sessionId)
        .eq("status", previousStatus)
        .select("status")
        .maybeSingle();
      if (updateError) throw new Error("order_status_update_failed");
      if (!updatedOrder) {
        await logStripeWebhook(supabase, "ignored_after_status_change", summary);
        return NextResponse.json({ ok: true, ignored: summary.eventType, status: "changed" });
      }
      await logStripeWebhook(supabase, summary.paymentStatus || "not_paid", summary).catch(() => undefined);
      return NextResponse.json({ ok: true, pending: true });
    }

    const result = await settlePaidStripeSession({ summary, supabase });
    if (!result.ok) {
      await logStripeWebhook(supabase, result.reason, summary).catch(() => undefined);
      if (result.reason === "payment_reversed") {
        return NextResponse.json({ ok: true, ignored: summary.eventType, status: result.reason });
      }
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
