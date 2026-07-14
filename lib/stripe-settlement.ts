import {
  isExpectedPaidStripeSession,
  type StripeCheckoutSessionSummary,
  type StripeProductType
} from "@/lib/stripe";
import type { createServerClient } from "@/lib/supabase";

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>;

export type StripeReconciliationStatus = "active" | "processing" | "unpaid" | "expired" | "unknown";

export type StripeOrder = {
  amount_total?: unknown;
  book_requested?: unknown;
  book_title?: unknown;
  course_id?: unknown;
  currency?: unknown;
  order_id?: unknown;
  product_type?: unknown;
  provider?: unknown;
  status?: unknown;
  user_id?: unknown;
};

const reversedOrderStatuses = new Set(["refunded", "reversed", "denied", "disputed"]);
const settledOrderStatuses = new Set(["completed", "partially_refunded", ...reversedOrderStatuses]);

function stringFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function normalizeStripeProductType(value: unknown): StripeProductType {
  const normalized = stringFrom(value);
  if (normalized === "library_membership" || normalized === "legacy_course") return normalized;
  return "annual_pass";
}

export function stripeCheckoutFailureStatus(eventType: unknown): "expired" | "failed" | null {
  const normalized = stringFrom(eventType);
  if (normalized === "checkout.session.expired") return "expired";
  if (normalized === "checkout.session.async_payment_failed") return "failed";
  return null;
}

export function isSettledStripeOrderStatus(status: unknown) {
  return settledOrderStatuses.has(stringFrom(status).toLowerCase());
}

export function isReversedStripeOrderStatus(status: unknown) {
  return reversedOrderStatuses.has(stringFrom(status).toLowerCase());
}

export async function findStripeOrder({
  sessionId,
  supabase,
  userId
}: {
  sessionId: string;
  supabase: ServerClient;
  userId?: string;
}) {
  let query = supabase
    .from("paypal_orders")
    .select("*")
    .eq("provider", "stripe")
    .eq("order_id", sessionId);

  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("order_lookup_failed");
  return (data || null) as StripeOrder | null;
}

export async function settlePaidStripeSession({
  eventName,
  order: suppliedOrder,
  summary,
  supabase
}: {
  eventName?: string;
  order?: StripeOrder | null;
  summary: StripeCheckoutSessionSummary;
  supabase: ServerClient;
}) {
  const order = suppliedOrder === undefined
    ? await findStripeOrder({ sessionId: summary.sessionId, supabase })
    : suppliedOrder;

  if (!order) return { ok: false as const, reason: "order_not_found" as const };
  if (stringFrom(order.provider).toLowerCase() !== "stripe") {
    return { ok: false as const, reason: "order_not_found" as const };
  }
  if (!isExpectedPaidStripeSession(summary, order)) {
    return { ok: false as const, reason: "payment_mismatch" as const };
  }

  const productType = normalizeStripeProductType(order.product_type);
  if (isReversedStripeOrderStatus(order.status)) {
    return { ok: false as const, reason: "payment_reversed" as const };
  }
  // A partial refund is a settled financial state. Replaying validate_payment
  // would incorrectly overwrite it with "completed".
  if (stringFrom(order.status).toLowerCase() === "partially_refunded") {
    return { alreadySettled: true as const, data: null, ok: true as const, order, productType };
  }

  const { data, error } = await supabase.rpc("validate_payment", {
    p_amount_total: summary.amountTotal,
    p_book_requested: Boolean(order.book_requested),
    p_book_title: stringFrom(order.book_title),
    p_capture_id: summary.captureId || summary.sessionId,
    p_course_id: productType === "legacy_course" ? stringFrom(order.course_id) || null : null,
    p_currency: summary.currency,
    p_event_name: summary.eventType || eventName || "stripe_checkout_reconciled",
    p_order_id: summary.sessionId,
    p_product_type: productType,
    p_provider: "stripe",
    p_raw_payload: null,
    p_user_id: stringFrom(order.user_id)
  });

  if (error) throw new Error("payment_validation_failed");
  return { data, ok: true as const, order, productType };
}

export async function hasActiveStripeEntitlement({
  order,
  supabase
}: {
  order: StripeOrder;
  supabase: ServerClient;
}) {
  const productType = normalizeStripeProductType(order.product_type);
  const orderId = stringFrom(order.order_id);
  const userId = stringFrom(order.user_id);
  const now = new Date().toISOString();

  if (!orderId || !userId) return false;

  if (productType === "annual_pass") {
    const { data, error } = await supabase
      .from("annual_access_passes")
      .select("id")
      .eq("provider", "stripe")
      .eq("provider_order_id", orderId)
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", now)
      .maybeSingle();
    if (error) throw new Error("entitlement_lookup_failed");
    return Boolean(data);
  }

  if (productType === "library_membership") {
    const { data, error } = await supabase
      .from("library_memberships")
      .select("id")
      .eq("provider", "stripe")
      .eq("provider_order_id", orderId)
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", now)
      .maybeSingle();
    if (error) throw new Error("entitlement_lookup_failed");
    return Boolean(data);
  }

  const courseId = stringFrom(order.course_id);
  if (!courseId) return false;
  const { data, error } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("payment_order_id", orderId)
    .eq("course_id", courseId)
    .eq("etudiant_id", userId)
    .eq("statut", "en_cours")
    .maybeSingle();
  if (error) throw new Error("entitlement_lookup_failed");
  return Boolean(data);
}

export function stripeReconciliationStatus({
  orderStatus,
  summary
}: {
  orderStatus?: unknown;
  summary: StripeCheckoutSessionSummary;
}): StripeReconciliationStatus {
  const localStatus = stringFrom(orderStatus).toLowerCase();
  const sessionStatus = stringFrom(summary.status).toLowerCase();
  const paymentStatus = stringFrom(summary.paymentStatus).toLowerCase();

  if (localStatus === "expired" || sessionStatus === "expired") return "expired";
  if (["failed", "async_payment_failed"].includes(localStatus)) return "unpaid";
  if (reversedOrderStatuses.has(localStatus)) return "unpaid";
  if (paymentStatus === "paid") return "processing";
  if (sessionStatus === "complete") return "processing";
  if (paymentStatus === "unpaid" || sessionStatus === "open") return "unpaid";
  return "unknown";
}
