import { pgRead } from "@/lib/postgres";
import {
  isExpectedPaidStripeSession,
  type StripeCheckoutSessionSummary,
  type StripeProductType
} from "@/lib/stripe";
import type { createServerContext } from "@/lib/postgres";

type ServerClient = NonNullable<ReturnType<typeof createServerContext>>;

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
  context,
  userId
}: {
  sessionId: string;
  context: ServerClient;
  userId?: string;
}) {
  const { data, error } = await pgRead(
    'select * from public.paypal_orders where provider=$1 and order_id=$2 and ($3::uuid is null or user_id=$3)',
    ["stripe", sessionId, userId || null], "optional");
  if (error) throw new Error("order_lookup_failed");
  return (data || null) as StripeOrder | null;
}

export async function settlePaidStripeSession({
  eventName,
  order: suppliedOrder,
  summary,
  context
}: {
  eventName?: string;
  order?: StripeOrder | null;
  summary: StripeCheckoutSessionSummary;
  context: ServerClient;
}) {
  const order = suppliedOrder === undefined
    ? await findStripeOrder({ sessionId: summary.sessionId, context })
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

  const { data, error } = await pgRead("select public.validate_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) as result", ["stripe", summary.sessionId, summary.captureId || summary.sessionId, stringFrom(order.user_id), productType === "legacy_course" ? stringFrom(order.course_id) || null : null, summary.amountTotal, summary.currency, summary.eventType || eventName || "stripe_checkout_reconciled", JSON.stringify({}), Boolean(order.book_requested), stringFrom(order.book_title), productType], "scalar");

  if (error) throw new Error("payment_validation_failed");
  return { data, ok: true as const, order, productType };
}

export async function hasActiveStripeEntitlement({
  order,
  context
}: {
  order: StripeOrder;
  context: ServerClient;
}) {
  const productType = normalizeStripeProductType(order.product_type);
  const orderId = stringFrom(order.order_id);
  const userId = stringFrom(order.user_id);
  const now = new Date().toISOString();

  if (!orderId || !userId) return false;

  if (productType === "annual_pass") {
    const { data, error } = await pgRead("select t.\"id\" from public.\"annual_access_passes\" t where t.\"provider\" = $1 and t.\"provider_order_id\" = $2 and t.\"user_id\" = $3 and t.\"status\" = $4 and t.\"expires_at\" > $5", ["stripe", orderId, userId, "active", now], "optional");
    if (error) throw new Error("entitlement_lookup_failed");
    return Boolean(data);
  }

  if (productType === "library_membership") {
    const { data, error } = await pgRead("select t.\"id\" from public.\"library_memberships\" t where t.\"provider\" = $1 and t.\"provider_order_id\" = $2 and t.\"user_id\" = $3 and t.\"status\" = $4 and t.\"expires_at\" > $5", ["stripe", orderId, userId, "active", now], "optional");
    if (error) throw new Error("entitlement_lookup_failed");
    return Boolean(data);
  }

  const courseId = stringFrom(order.course_id);
  if (!courseId) return false;
  const { data, error } = await pgRead("select t.\"id\" from public.\"course_enrollments\" t where t.\"payment_order_id\" = $1 and t.\"course_id\" = $2 and t.\"etudiant_id\" = $3 and t.\"statut\" = $4", [orderId, courseId, userId, "en_cours"], "optional");
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
