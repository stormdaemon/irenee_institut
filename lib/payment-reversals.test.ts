import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPayPalReversal,
  extractStripeReversal,
  validatePayPalWebhookHeaders,
  validateStripeWebhookHeader
} from "./payment-reversals";

test("Stripe full refunds and disputes become bounded reversal instructions", () => {
  assert.deepEqual(extractStripeReversal({
    id: "evt_refund_1",
    object: "event",
    type: "charge.refunded",
    data: { object: {
      id: "ch_1",
      amount: 9900,
      amount_refunded: 9900,
      currency: "eur",
      payment_intent: "pi_1",
      refunded: true
    } }
  }), {
    amountTotal: 9900,
    captureId: "pi_1",
    currency: "EUR",
    eventId: "evt_refund_1",
    eventName: "charge.refunded",
    kind: "refunded",
    objectId: "ch_1",
    orderId: ""
  });

  assert.equal(extractStripeReversal({
    id: "evt_partial",
    object: "event",
    type: "charge.refunded",
    data: { object: {
      id: "ch_1",
      amount: 9900,
      amount_refunded: 1000,
      currency: "eur",
      payment_intent: "pi_1",
      refunded: false
    } }
  })?.kind, "refunded");

  assert.equal(extractStripeReversal({
    id: "evt_dispute",
    object: "event",
    type: "charge.dispute.created",
    data: { object: { id: "dp_1", amount: 9900, currency: "eur", payment_intent: "pi_1" } }
  })?.kind, "disputed");

  assert.equal(extractStripeReversal({
    id: "evt_won",
    object: "event",
    type: "charge.dispute.closed",
    data: { object: { id: "dp_1", payment_intent: "pi_1", status: "won" } }
  }), null);
  assert.equal(extractStripeReversal({ id: "evt_other", type: "customer.created" }), null);
});

test("PayPal refunded, reversed and denied captures map to the original order", () => {
  assert.deepEqual(extractPayPalReversal({
    id: "WH-REFUND-1",
    event_type: "PAYMENT.CAPTURE.REFUNDED",
    resource: {
      id: "REFUND-1",
      amount: { currency_code: "EUR", value: "99.00" },
      supplementary_data: { related_ids: { capture_id: "CAPTURE-1", order_id: "ORDER-1" } }
    }
  }), {
    amountTotal: 9900,
    captureId: "CAPTURE-1",
    currency: "EUR",
    eventId: "WH-REFUND-1",
    eventName: "PAYMENT.CAPTURE.REFUNDED",
    kind: "refunded",
    objectId: "REFUND-1",
    orderId: "ORDER-1"
  });

  assert.equal(extractPayPalReversal({
    id: "WH-REVERSED-1",
    event_type: "PAYMENT.CAPTURE.REVERSED",
    resource: { id: "CAPTURE-1", supplementary_data: { related_ids: { order_id: "ORDER-1" } } }
  })?.kind, "reversed");
  assert.equal(extractPayPalReversal({
    id: "WH-DENIED-1",
    event_type: "PAYMENT.CAPTURE.DENIED",
    resource: { id: "CAPTURE-1", supplementary_data: { related_ids: { order_id: "ORDER-1" } } }
  })?.kind, "denied");
  assert.deepEqual(extractPayPalReversal({
    id: "WH-DISPUTE-1",
    event_type: "CUSTOMER.DISPUTE.CREATED",
    resource: {
      dispute_amount: { currency_code: "EUR", value: "99.00" },
      dispute_id: "PP-D-123",
      disputed_transactions: [{ seller_transaction_id: "CAPTURE-1" }]
    }
  }), {
    amountTotal: 9900,
    captureId: "CAPTURE-1",
    currency: "EUR",
    eventId: "WH-DISPUTE-1",
    eventName: "CUSTOMER.DISPUTE.CREATED",
    kind: "disputed",
    objectId: "PP-D-123",
    orderId: ""
  });
});

test("PayPal rejects malformed headers locally before OAuth verification", () => {
  assert.equal(validatePayPalWebhookHeaders(new Headers()).ok, false);
  assert.equal(validatePayPalWebhookHeaders(new Headers({
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://attacker.example/cert",
    "paypal-transmission-id": "transmission-1",
    "paypal-transmission-sig": "YWJjZA==",
    "paypal-transmission-time": "2026-07-09T10:00:00Z"
  })).ok, false);
  assert.equal(validatePayPalWebhookHeaders(new Headers({
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.paypal.com/v1/notifications/certs/CERT-1",
    "paypal-transmission-id": "transmission-1",
    "paypal-transmission-sig": "YWJjZA==",
    "paypal-transmission-time": "2026-07-09T10:00:00Z"
  })).ok, true);
});

test("Stripe rejects malformed signatures before settings or persistence work", () => {
  assert.equal(validateStripeWebhookHeader(null), false);
  assert.equal(validateStripeWebhookHeader("t=1700000000,v1=not-hex"), false);
  assert.equal(validateStripeWebhookHeader(`t=1700000000,v1=${"a".repeat(64)}`), true);
});
