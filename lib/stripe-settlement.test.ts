import assert from "node:assert/strict";
import test from "node:test";
import {
  isReversedStripeOrderStatus,
  isSettledStripeOrderStatus,
  stripeCheckoutFailureStatus,
  stripeReconciliationStatus
} from "./stripe-settlement";
import type { StripeCheckoutSessionSummary } from "./stripe";

function summary(
  paymentStatus: string,
  status: string
): StripeCheckoutSessionSummary {
  return {
    amountTotal: 9900,
    bookRequested: false,
    bookTitle: "",
    captureId: "pi_test_reconcile",
    currency: "EUR",
    eventId: "",
    eventType: "",
    metadata: { product_type: "annual_pass", user_id: "user-reconcile" },
    paymentStatus,
    productType: "annual_pass",
    sessionId: "cs_test_reconcile",
    status,
    userId: "user-reconcile"
  };
}

test("Stripe reconciliation exposes only bounded non-active states before entitlement verification", () => {
  assert.equal(stripeReconciliationStatus({ summary: summary("paid", "complete") }), "processing");
  assert.equal(stripeReconciliationStatus({ summary: summary("unpaid", "complete") }), "processing");
  assert.equal(stripeReconciliationStatus({ summary: summary("unpaid", "open") }), "unpaid");
  assert.equal(stripeReconciliationStatus({ summary: summary("unpaid", "expired") }), "expired");
  assert.equal(stripeReconciliationStatus({ orderStatus: "failed", summary: summary("unpaid", "complete") }), "unpaid");
  assert.equal(stripeReconciliationStatus({ summary: summary("", "") }), "unknown");
});

test("Stripe terminal checkout events map safely and never supersede settled orders", () => {
  assert.equal(stripeCheckoutFailureStatus("checkout.session.expired"), "expired");
  assert.equal(stripeCheckoutFailureStatus("checkout.session.async_payment_failed"), "failed");
  assert.equal(stripeCheckoutFailureStatus("checkout.session.completed"), null);

  for (const status of ["completed", "partially_refunded", "refunded", "reversed", "denied", "disputed"]) {
    assert.equal(isSettledStripeOrderStatus(status), true, status);
  }
  for (const status of ["refunded", "reversed", "denied", "disputed"]) {
    assert.equal(isReversedStripeOrderStatus(status), true, status);
  }
  assert.equal(isReversedStripeOrderStatus("partially_refunded"), false);
  assert.equal(isSettledStripeOrderStatus("open"), false);
  assert.equal(isSettledStripeOrderStatus("failed"), false);
});
