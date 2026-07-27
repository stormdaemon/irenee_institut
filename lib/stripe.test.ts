import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildStripeCheckoutSessionParams,
  extractStripeCheckoutSessionSummary,
  isExpectedPaidStripeSession,
  isExpectedStripeSession,
  parseStripeAmountToCents,
  verifyStripeWebhookSignature,
  type StripeCheckoutSessionPayloadInput
} from "./stripe";
import { isStripeCheckoutClientSecret } from "./stripe-checkout-url";

const course = {
  id: "annual-pass-saint-irenee",
  slug: "pass-annuel-institut-apologetique-saint-irenee",
  titre: "Pass annuel Institut Saint Irenee"
};

const profile = {
  id: "user-456",
  email: "student@example.com",
  prenom: "Anne",
  nom: "Martin"
};

function checkoutInput(overrides: Partial<StripeCheckoutSessionPayloadInput> = {}): StripeCheckoutSessionPayloadInput {
  return {
    amountCents: 9900,
    bookRequested: true,
    bookTitle: "Mere de Dieu",
    cancelPath: "/formations?stripe_cancelled=1",
    course,
    origin: "https://irenee-institut.org/",
    productType: "annual_pass",
    profile,
    returnPath: "/paiement/merci?stripe_session_id={CHECKOUT_SESSION_ID}",
    ...overrides
  };
}

function signedHeader(payload: string, secret: string, timestamp = 1700000000) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

test("parseStripeAmountToCents accepts free-form euro amounts", () => {
  assert.equal(parseStripeAmountToCents("99"), 9900);
  assert.equal(parseStripeAmountToCents("12,34"), 1234);
  assert.equal(parseStripeAmountToCents(""), 9900);
  assert.throws(() => parseStripeAmountToCents("0.50"), /au moins 1 euro/);
});

test("parseStripeAmountToCents rejects unsafe or unreasonable amounts", () => {
  assert.throws(() => parseStripeAmountToCents("0.99"), /moins/);
  assert.throws(() => parseStripeAmountToCents("1000001"), /maximum/);
  assert.throws(() => parseStripeAmountToCents("1e309"), /montant/i);
});

test("buildStripeCheckoutSessionParams creates a hosted EUR checkout with metadata", () => {
  const params = buildStripeCheckoutSessionParams(checkoutInput());

  assert.equal(params.get("mode"), "payment");
  assert.equal(params.get("locale"), "fr");
  assert.equal(params.get("customer_email"), "student@example.com");
  assert.equal(params.get("client_reference_id"), "user-456");
  assert.equal(params.get("success_url"), "https://irenee-institut.org/paiement/merci?stripe_session_id={CHECKOUT_SESSION_ID}");
  assert.equal(params.get("cancel_url"), "https://irenee-institut.org/formations?stripe_cancelled=1");
  assert.equal(params.get("line_items[0][price_data][currency]"), "eur");
  assert.equal(params.get("line_items[0][price_data][unit_amount]"), "9900");
  assert.equal(params.get("line_items[0][price_data][product_data][name]"), "Pass annuel Institut Saint Irenee");
  assert.equal(params.get("metadata[user_id]"), "user-456");
  assert.equal(params.get("metadata[product_type]"), "annual_pass");
  assert.equal(params.get("metadata[book_requested]"), "true");
  assert.equal(params.get("metadata[book_title]"), "Mere de Dieu");
  assert.equal(params.get("payment_intent_data[metadata][product_type]"), "annual_pass");
});

test("buildStripeCheckoutSessionParams keeps the payment on the site in custom mode", () => {
  const params = buildStripeCheckoutSessionParams(checkoutInput({ uiMode: "custom" }));

  assert.equal(params.get("ui_mode"), "custom");
  assert.equal(params.get("return_url"), "https://irenee-institut.org/paiement/merci?stripe_session_id={CHECKOUT_SESSION_ID}");
  // Stripe refuse ces deux paramètres hors mode hébergé.
  assert.equal(params.get("success_url"), null);
  assert.equal(params.get("cancel_url"), null);
  // Les métadonnées de rapprochement restent identiques au mode hébergé.
  assert.equal(params.get("client_reference_id"), "user-456");
  assert.equal(params.get("metadata[user_id]"), "user-456");
  assert.equal(params.get("metadata[product_type]"), "annual_pass");
  assert.equal(params.get("line_items[0][price_data][unit_amount]"), "9900");
});

test("isStripeCheckoutClientSecret only accepts a secret bound to its own session", () => {
  const sessionId = "cs_live_a1B2c3D4";
  // Format réellement renvoyé par Stripe : la partie secrète est percent-encodée.
  const secret = `${sessionId}_secret_fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSdwbEhq`;

  assert.equal(isStripeCheckoutClientSecret(secret, sessionId), true);
  assert.equal(isStripeCheckoutClientSecret(secret), true);
  // Un secret appartenant à une autre session ne doit jamais être servi.
  assert.equal(isStripeCheckoutClientSecret(secret, "cs_live_other"), false);
  for (const blocked of [
    "",
    "pk_live_a1B2c3",
    "cs_live_a1B2c3D4",
    "https://checkout.stripe.com/c/pay/cs_live_a1B2c3D4",
    `${sessionId}_secret_${"x".repeat(1200)}`,
    null,
    undefined,
    42
  ]) {
    assert.equal(isStripeCheckoutClientSecret(blocked, sessionId), false, String(blocked));
  }
});

test("verifyStripeWebhookSignature validates Stripe signed payloads", () => {
  const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
  const secret = "whsec_test_secret";
  const signature = signedHeader(payload, secret);

  assert.equal(verifyStripeWebhookSignature({ now: 1700000000, rawBody: payload, secret, signature }), true);
  assert.equal(verifyStripeWebhookSignature({ now: 1700000000, rawBody: payload, secret: "whsec_other", signature }), false);
  assert.equal(verifyStripeWebhookSignature({ now: 1700001000, rawBody: payload, secret, signature }), false);
});

test("extractStripeCheckoutSessionSummary supports snapshot and thin event shapes", () => {
  const snapshot = extractStripeCheckoutSessionSummary({
    id: "evt_snapshot",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_live_123",
        object: "checkout.session",
        amount_total: 9900,
        currency: "eur",
        metadata: { product_type: "annual_pass", user_id: "user-456" },
        payment_intent: "pi_123",
        payment_status: "paid",
        status: "complete"
      }
    }
  });

  assert.equal(snapshot.eventId, "evt_snapshot");
  assert.equal(snapshot.eventType, "checkout.session.completed");
  assert.equal(snapshot.sessionId, "cs_live_123");
  assert.equal(snapshot.captureId, "pi_123");
  assert.equal(snapshot.amountTotal, 9900);
  assert.equal(snapshot.currency, "EUR");
  assert.equal(snapshot.productType, "annual_pass");

  const thin = extractStripeCheckoutSessionSummary({
    id: "evt_thin",
    object: "v2.core.event",
    type: "checkout.session.completed",
    related_object: {
      id: "cs_live_456",
      type: "checkout.session",
      url: "/v1/checkout/sessions/cs_live_456"
    }
  });

  assert.equal(thin.eventId, "evt_thin");
  assert.equal(thin.sessionId, "");
  assert.equal(thin.relatedObject?.id, "cs_live_456");
  assert.equal(thin.relatedObject?.url, "/v1/checkout/sessions/cs_live_456");
});

test("paid Stripe sessions must match the server-owned pending order", () => {
  const summary = {
    amountTotal: 9900,
    bookRequested: false,
    bookTitle: "",
    captureId: "pi_123",
    currency: "EUR",
    eventId: "evt_123",
    eventType: "checkout.session.completed",
    metadata: { product_type: "annual_pass", user_id: "user-456" },
    paymentStatus: "paid",
    productType: "annual_pass" as const,
    sessionId: "cs_123",
    status: "complete",
    userId: "user-456"
  };
  const order = {
    amount_total: 9900,
    currency: "EUR",
    order_id: "cs_123",
    product_type: "annual_pass",
    provider: "stripe",
    user_id: "user-456"
  };

  assert.equal(isExpectedPaidStripeSession(summary, order), true);
  assert.equal(isExpectedPaidStripeSession({ ...summary, amountTotal: 100 }, order), false);
  assert.equal(isExpectedPaidStripeSession({ ...summary, currency: "USD" }, order), false);
  assert.equal(isExpectedPaidStripeSession({ ...summary, userId: "other" }, order), false);
  assert.equal(isExpectedPaidStripeSession(summary, null), false);

  const unpaidSummary = { ...summary, paymentStatus: "unpaid", status: "open" };
  assert.equal(isExpectedStripeSession(unpaidSummary, order), true);
  assert.equal(isExpectedPaidStripeSession(unpaidSummary, order), false);
  assert.equal(isExpectedStripeSession({ ...unpaidSummary, productType: "library_membership" }, order), false);
});
