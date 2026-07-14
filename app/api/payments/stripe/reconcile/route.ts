import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { assertSameOrigin, RequestSecurityError } from "@/lib/request-security";
import { getSystemSettings } from "@/lib/settings";
import {
  findStripeOrder,
  hasActiveStripeEntitlement,
  isReversedStripeOrderStatus,
  normalizeStripeProductType,
  settlePaidStripeSession,
  stripeReconciliationStatus,
  type StripeReconciliationStatus
} from "@/lib/stripe-settlement";
import {
  extractStripeCheckoutSessionSummary,
  getStripeConfig,
  isExpectedStripeSession,
  retrieveStripeObject
} from "@/lib/stripe";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store" };
const stripeSessionIdPattern = /^cs_[A-Za-z0-9_]{8,250}$/;
const safeFailureStages = new Set([
  "entitlement_lookup_failed",
  "order_lookup_failed",
  "payment_validation_failed"
]);

function safeFailureStage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return safeFailureStages.has(message) ? message : "stripe_reconcile_unavailable";
}

function privateJson(
  body: {
    ok: boolean;
    product?: string;
    status: StripeReconciliationStatus;
  },
  status = 200,
  headers?: Record<string, string>
) {
  return NextResponse.json(body, {
    headers: { ...privateHeaders, ...headers },
    status
  });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 403;
    return privateJson({ ok: false, status: "unknown" }, status);
  }

  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  let limit: Awaited<ReturnType<typeof checkRateLimit>>;
  try {
    limit = await checkRateLimit(`stripe-reconcile:user:${user.id}`, 30, 10 * 60 * 1000);
  } catch {
    console.error("stripe_reconcile_failed", { stage: "rate_limit_unavailable" });
    return privateJson({ ok: false, status: "processing" }, 503);
  }
  if (!limit.allowed) {
    return privateJson(
      { ok: false, status: "processing" },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 4096);
    if (!body || Array.isArray(body) || typeof body !== "object") {
      return privateJson({ ok: false, status: "unknown" }, 400);
    }
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return privateJson({ ok: false, status: "unknown" }, status);
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!stripeSessionIdPattern.test(sessionId)) {
    return privateJson({ ok: false, status: "unknown" }, 400);
  }

  try {
    const order = await findStripeOrder({ sessionId, supabase, userId: user.id });
    if (!order) return privateJson({ ok: false, status: "unknown" }, 404);

    const product = normalizeStripeProductType(order.product_type);
    if (isReversedStripeOrderStatus(order.status)) {
      return privateJson({ ok: true, product, status: "unpaid" });
    }
    const settings = await getSystemSettings(supabase);
    const stripeSession = await retrieveStripeObject({
      config: getStripeConfig(settings),
      url: `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`
    });
    const summary = extractStripeCheckoutSessionSummary(stripeSession);

    if (!isExpectedStripeSession(summary, order)) {
      console.error("stripe_reconcile_rejected", { stage: "payment_mismatch" });
      return privateJson({ ok: false, status: "unknown" }, 409);
    }

    if (summary.paymentStatus !== "paid") {
      return privateJson({
        ok: true,
        product,
        status: stripeReconciliationStatus({ orderStatus: order.status, summary })
      });
    }

    const settlement = await settlePaidStripeSession({
      eventName: "stripe_checkout_reconciled",
      order,
      summary,
      supabase
    });
    if (!settlement.ok) {
      console.error("stripe_reconcile_rejected", { stage: settlement.reason });
      return privateJson({ ok: false, status: "unknown" }, 409);
    }

    const active = await hasActiveStripeEntitlement({ order: settlement.order, supabase });
    return privateJson({
      ok: true,
      product: settlement.productType,
      status: active ? "active" : "processing"
    });
  } catch (error) {
    console.error("stripe_reconcile_failed", {
      stage: safeFailureStage(error)
    });
    return privateJson({ ok: false, status: "processing" }, 503);
  }
}
