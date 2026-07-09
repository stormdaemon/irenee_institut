import { NextResponse } from "next/server";
import {
  capturePayPalOrder,
  extractCompletedCapture,
  extractPayPalOrderIdFromWebhook,
  getPayPalConfig,
  isExpectedCompletedCapture,
  parsePayPalValueToCents,
  PAYPAL_CURRENCY,
  verifyPayPalWebhookSignature
} from "@/lib/paypal";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";
import { RequestBodyTooLargeError, readTextBodyWithLimit } from "@/lib/webhook-security";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractPayPalReversal, validatePayPalWebhookHeaders } from "@/lib/payment-reversals";
import { getTrustedClientIp } from "@/lib/request-security";
import { recordSecurityEvent } from "@/lib/security-audit";

export const runtime = "nodejs";

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    amount?: {
      currency_code?: string;
      value?: string;
    };
    status?: string;
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
  };
};

function stringFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

async function logWebhook(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  event: PayPalWebhookEvent,
  status: string,
  orderId?: string
) {
  const eventId = stringFrom(event.id).slice(0, 255);
  if (!eventId) return;
  await supabase.from("payment_events").upsert({
    provider: "paypal",
    provider_event_id: eventId,
    event_name: stringFrom(event.event_type).slice(0, 200) || "paypal_webhook",
    order_id: stringFrom(orderId).slice(0, 255) || null,
    amount_total: parsePayPalValueToCents(event.resource?.amount?.value),
    currency: stringFrom(event.resource?.amount?.currency_code) || PAYPAL_CURRENCY,
    status
  }, { onConflict: "provider,provider_event_id" });
}

async function validateCapturedOrder({
  capture,
  orderId,
  status,
  supabase
}: {
  capture: {
    amountCents: number;
    captureId: string;
    currency: string;
    status: string;
  };
  orderId: string;
  status: string;
  supabase: NonNullable<ReturnType<typeof createServerClient>>;
}) {
  const { data: orderRow, error: orderError } = await supabase
    .from("paypal_orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (orderError) throw new Error("order_lookup_failed");
  if (!orderRow) return { ok: false, missingOrder: true };
  if (["completed", "partially_refunded", "refunded", "reversed", "denied", "disputed"].includes(stringFrom(orderRow.status).toLowerCase())) {
    return { ok: true, alreadySettled: true, data: null };
  }

  if (!isExpectedCompletedCapture(capture, {
    amountCents: Number(orderRow.amount_total || 0),
    currency: stringFrom(orderRow.currency) || PAYPAL_CURRENCY
  })) {
    return { ok: false, paymentMismatch: true };
  }

  const { data, error } = await supabase.rpc("validate_paypal_payment", {
    p_amount_total: capture.amountCents,
    p_book_requested: Boolean(orderRow.book_requested),
    p_book_title: String(orderRow.book_title || ""),
    p_capture_id: capture.captureId,
    p_course_id: orderRow.course_id,
    p_currency: capture.currency,
    p_event_name: status,
    p_order_id: orderId,
    p_product_type: String(orderRow.product_type || "annual_pass"),
    p_raw_payload: null,
    p_user_id: orderRow.user_id
  });

  if (error) throw new Error("payment_validation_failed");
  return { ok: true, data };
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "paypal_checkout_valid" });
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanement indisponible." }, { status: 501 });

  let rawBody: string;
  try {
    rawBody = await readTextBodyWithLimit(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Payload PayPal illisible." }, { status: 400 });
  }

  let event: PayPalWebhookEvent;
  let authenticated = false;
  try {
    event = JSON.parse(rawBody || "{}") as PayPalWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "Payload PayPal invalide." }, { status: 400 });
  }
  const orderId = extractPayPalOrderIdFromWebhook(event);

  const headerValidation = validatePayPalWebhookHeaders(request.headers);
  if (!headerValidation.ok) {
    return NextResponse.json({ ok: false, error: "En-têtes PayPal invalides." }, { status: 401 });
  }

  try {
    const clientIp = getTrustedClientIp(request);
    const limit = await checkRateLimit(`webhook:paypal:ip:${clientIp}`, 120, 60_000);
    if (!limit.allowed) {
      await recordSecurityEvent({ eventType: "payment.webhook.rate_limited", metadata: { reason: "paypal" }, request });
      return NextResponse.json({ ok: false, error: "Trop de requêtes webhook." }, {
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
        status: 429
      });
    }

    const settings = await getSystemSettings(supabase);
    const config = getPayPalConfig(settings);
    const verified = await verifyPayPalWebhookSignature({ config, event, headers: request.headers });

    if (!verified) {
      await recordSecurityEvent({ eventType: "payment.webhook.signature_rejected", metadata: { reason: "paypal" }, request });
      return NextResponse.json({ ok: false, error: "Signature PayPal invalide." }, { status: 401 });
    }
    authenticated = true;

    const eventType = stringFrom(event.event_type);
    if (!stringFrom(event.id)) {
      return NextResponse.json({ ok: false, error: "Identifiant d'événement PayPal manquant." }, { status: 400 });
    }

    const reversal = extractPayPalReversal(event);
    if (reversal) {
      const { data, error } = await supabase.rpc("process_payment_reversal", {
        p_amount_total: reversal.amountTotal,
        p_capture_id: reversal.captureId,
        p_currency: reversal.currency,
        p_event_name: reversal.eventName,
        p_kind: reversal.kind,
        p_object_id: reversal.objectId,
        p_order_id: reversal.orderId,
        p_provider: "paypal",
        p_provider_event_id: reversal.eventId
      });
      if (error) throw new Error("payment_reversal_failed");
      if (!(data as { ok?: boolean } | null)?.ok) {
        return NextResponse.json({ ok: false, error: "La commande PayPal liée au litige est introuvable." }, { status: 409 });
      }
      return NextResponse.json({ ok: true, reversal: data });
    }

    if (eventType === "CHECKOUT.ORDER.APPROVED" && orderId) {
      const { data: orderRow, error: orderError } = await supabase
        .from("paypal_orders")
        .select("provider,status")
        .eq("order_id", orderId)
        .maybeSingle();
      if (orderError) throw new Error("order_lookup_failed");
      if (!orderRow || stringFrom(orderRow.provider).toLowerCase() !== "paypal") {
        await logWebhook(supabase, event, "order_not_found", orderId).catch(() => undefined);
        return NextResponse.json({ ok: false, error: "Commande PayPal inconnue." }, { status: 409 });
      }
      const settledStatus = stringFrom(orderRow?.status).toLowerCase();
      if (["completed", "partially_refunded", "refunded", "reversed", "denied", "disputed"].includes(settledStatus)) {
        await logWebhook(supabase, event, `already_${settledStatus}`, orderId).catch(() => undefined);
        return NextResponse.json({ ok: true, alreadySettled: true, status: settledStatus });
      }

      const capture = await capturePayPalOrder({ config, orderId });
      const completedCapture = extractCompletedCapture(capture);
      if (!completedCapture) {
        await logWebhook(supabase, event, "approved_without_capture", orderId).catch(() => undefined);
        return NextResponse.json({ ok: true, pendingCapture: true });
      }

      const result = await validateCapturedOrder({
        capture: completedCapture,
        orderId,
        status: "paypal_order_approved_capture_completed",
        supabase
      });
      if (!result.ok) {
        await logWebhook(supabase, event, result.paymentMismatch ? "capture_mismatch" : "order_not_found", orderId).catch(() => undefined);
        return NextResponse.json({ ok: false, error: "La capture PayPal ne correspond pas à la commande." }, { status: 409 });
      }

      return NextResponse.json({ ok: true, captured: true });
    }

    if (eventType === "PAYMENT.CAPTURE.COMPLETED" && orderId && event.resource?.id) {
      const result = await validateCapturedOrder({
        capture: {
          amountCents: parsePayPalValueToCents(event.resource.amount?.value),
          captureId: String(event.resource.id),
          currency: stringFrom(event.resource.amount?.currency_code) || PAYPAL_CURRENCY,
          status: stringFrom(event.resource.status)
        },
        orderId,
        status: "paypal_webhook_capture_completed",
        supabase
      });

      if (!result.ok) {
        const failureStatus = result.paymentMismatch ? "capture_mismatch" : "order_not_found";
        await logWebhook(supabase, event, failureStatus, orderId).catch(() => undefined);
        if (result.paymentMismatch) {
          return NextResponse.json({ ok: false, error: "La capture PayPal ne correspond pas à la commande." }, { status: 409 });
        }
        return NextResponse.json({ ok: true, missingOrder: true });
      }

      return NextResponse.json({ ok: true, enrolled: true });
    }

    if (eventType === "PAYMENT.CAPTURE.PENDING") {
      await logWebhook(supabase, event, stringFrom(event.resource?.status) || "payment_not_completed", orderId).catch(() => undefined);
      return NextResponse.json({ ok: true, pending: true });
    }

    await logWebhook(supabase, event, "ignored", orderId).catch(() => undefined);
    return NextResponse.json({ ok: true, ignored: eventType || "unknown" });
  } catch {
    if (authenticated) {
      await logWebhook(supabase, event, "processing_error", orderId).catch(() => undefined);
      await recordSecurityEvent({ eventType: "payment.webhook.processing_error", metadata: { reason: "paypal" }, request });
    }
    return NextResponse.json({ ok: false, error: "Webhook PayPal impossible à traiter." }, { status: 500 });
  }
}
