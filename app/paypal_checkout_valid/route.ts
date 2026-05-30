import { NextResponse } from "next/server";
import { capturePayPalOrder, extractPayPalOrderIdFromWebhook, getPayPalConfig, parsePayPalValueToCents, PAYPAL_CURRENCY, verifyPayPalWebhookSignature } from "@/lib/paypal";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";

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
  await supabase.from("payment_events").upsert({
    provider: "paypal",
    provider_event_id: stringFrom(event.id) || `${stringFrom(event.event_type) || "paypal"}-${Date.now()}`,
    event_name: stringFrom(event.event_type) || "paypal_webhook",
    order_id: orderId || null,
    amount_total: parsePayPalValueToCents(event.resource?.amount?.value),
    currency: stringFrom(event.resource?.amount?.currency_code) || PAYPAL_CURRENCY,
    status,
    raw_payload: event
  }, { onConflict: "provider,provider_event_id" });
}

async function validateCapturedOrder({
  captureId,
  event,
  orderId,
  status,
  supabase
}: {
  captureId: string;
  event: PayPalWebhookEvent | unknown;
  orderId: string;
  status: string;
  supabase: NonNullable<ReturnType<typeof createServerClient>>;
}) {
  const { data: orderRow, error: orderError } = await supabase
    .from("paypal_orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);
  if (!orderRow) return { ok: false, missingOrder: true };

  const resource = (event as PayPalWebhookEvent).resource;
  const amountCents = parsePayPalValueToCents(resource?.amount?.value) || Number(orderRow.amount_total || 0);
  const currency = stringFrom(resource?.amount?.currency_code) || PAYPAL_CURRENCY;

  const { data, error } = await supabase.rpc("validate_paypal_payment", {
    p_amount_total: amountCents,
    p_book_requested: Boolean(orderRow.book_requested),
    p_capture_id: captureId,
    p_course_id: orderRow.course_id,
    p_currency: currency,
    p_event_name: status,
    p_order_id: orderId,
    p_raw_payload: event,
    p_user_id: orderRow.user_id
  });

  if (error) throw new Error(error.message);
  return { ok: true, data };
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "paypal_checkout_valid" });
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanement indisponible." }, { status: 501 });

  const rawBody = await request.text();
  const event = JSON.parse(rawBody || "{}") as PayPalWebhookEvent;
  const orderId = extractPayPalOrderIdFromWebhook(event);

  try {
    const settings = await getSystemSettings(supabase);
    const config = getPayPalConfig(settings);
    const verified = await verifyPayPalWebhookSignature({ config, event, headers: request.headers });

    if (!verified) {
      await logWebhook(supabase, event, "invalid_signature", orderId).catch(() => undefined);
      return NextResponse.json({ ok: false, error: "Signature PayPal invalide." }, { status: 401 });
    }

    const eventType = stringFrom(event.event_type);

    if (eventType === "CHECKOUT.ORDER.APPROVED" && orderId) {
      const { data: orderRow } = await supabase.from("paypal_orders").select("status").eq("order_id", orderId).maybeSingle();
      if (orderRow?.status === "completed") {
        await logWebhook(supabase, event, "already_completed", orderId).catch(() => undefined);
        return NextResponse.json({ ok: true, alreadyCompleted: true });
      }

      const capture = await capturePayPalOrder({ config, orderId });
      const captureResource = capture?.purchase_units?.[0]?.payments?.captures?.[0];
      if (!captureResource?.id) {
        await logWebhook(supabase, event, "approved_without_capture", orderId).catch(() => undefined);
        return NextResponse.json({ ok: true, pendingCapture: true });
      }

      await validateCapturedOrder({
        captureId: String(captureResource.id),
        event: capture,
        orderId,
        status: "paypal_order_approved_capture_completed",
        supabase
      });

      return NextResponse.json({ ok: true, captured: true });
    }

    if (eventType === "PAYMENT.CAPTURE.COMPLETED" && orderId && event.resource?.id) {
      const result = await validateCapturedOrder({
        captureId: String(event.resource.id),
        event,
        orderId,
        status: "paypal_webhook_capture_completed",
        supabase
      });

      if (!result.ok) {
        await logWebhook(supabase, event, "order_not_found", orderId).catch(() => undefined);
        return NextResponse.json({ ok: true, missingOrder: true });
      }

      return NextResponse.json({ ok: true, enrolled: true });
    }

    if (eventType === "PAYMENT.CAPTURE.PENDING" || eventType === "PAYMENT.CAPTURE.DENIED" || eventType === "CHECKOUT.PAYMENT-APPROVAL.REVERSED") {
      await logWebhook(supabase, event, stringFrom(event.resource?.status) || "payment_not_completed", orderId).catch(() => undefined);
      return NextResponse.json({ ok: true, pending: true });
    }

    await logWebhook(supabase, event, "ignored", orderId).catch(() => undefined);
    return NextResponse.json({ ok: true, ignored: eventType || "unknown" });
  } catch (error) {
    await logWebhook(supabase, event, "processing_error", orderId).catch(() => undefined);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Webhook PayPal impossible a traiter." }, { status: 500 });
  }
}
