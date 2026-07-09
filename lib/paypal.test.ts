import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPayPalOrderPayload,
  centsToPayPalValue,
  extractCompletedCapture,
  extractPayPalOrderIdFromWebhook,
  getPayPalBaseUrl,
  isExpectedCompletedCapture,
  normalizeBookTitle,
  parseEuroAmountToCents,
  parsePayPalValueToCents
} from "./paypal";

const course = {
  id: "course-123",
  slug: "introduction-apologetique",
  titre: "Introduction a l'apologetique"
};

const profile = {
  id: "user-456",
  email: "student@example.com",
  prenom: "Anne",
  nom: "Martin"
};

test("parseEuroAmountToCents accepts free-form euro amounts", () => {
  assert.equal(parseEuroAmountToCents("99"), 9900);
  assert.equal(parseEuroAmountToCents("12,34"), 1234);
  assert.equal(parseEuroAmountToCents(""), 9900);
  assert.throws(() => parseEuroAmountToCents("0.50"), /au moins 1 euro/);
});

test("parseEuroAmountToCents rejects unsafe or unreasonable amounts", () => {
  assert.throws(() => parseEuroAmountToCents("0.99"), /moins/);
  assert.throws(() => parseEuroAmountToCents("1000001"), /maximum/);
  assert.throws(() => parseEuroAmountToCents("1e309"), /montant/i);
});

test("centsToPayPalValue and parsePayPalValueToCents roundtrip PayPal money strings", () => {
  assert.equal(centsToPayPalValue(9900), "99.00");
  assert.equal(centsToPayPalValue(1234), "12.34");
  assert.equal(parsePayPalValueToCents("12.34"), 1234);
});

test("normalizeBookTitle trims whitespace and requires a title when a book is requested", () => {
  assert.equal(normalizeBookTitle("  Le   christianisme  "), "Le christianisme");
  assert.equal(normalizeBookTitle("", false), "");
  assert.throws(() => normalizeBookTitle(" ", true), /titre du livre/);
});

test("buildPayPalOrderPayload creates a EUR capture order with course and student metadata", () => {
  const payload = buildPayPalOrderPayload({
    amountCents: 9900,
    bookRequested: true,
    course,
    origin: "https://irenee-institut.org/",
    profile
  });

  assert.equal(payload.intent, "CAPTURE");
  assert.equal(payload.purchase_units[0].custom_id, "user-456:course-123");
  assert.equal(payload.purchase_units[0].amount.currency_code, "EUR");
  assert.equal(payload.purchase_units[0].amount.value, "99.00");
  assert.equal(payload.payment_source.paypal.experience_context.shipping_preference, "NO_SHIPPING");
  assert.equal(payload.payment_source.paypal.experience_context.return_url, "https://irenee-institut.org/paiement/merci?course=introduction-apologetique&book=1");
});

test("extractCompletedCapture returns the completed capture summary", () => {
  const summary = extractCompletedCapture({
    purchase_units: [
      {
        payments: {
          captures: [
            { id: "CAPTURE-1", status: "COMPLETED", amount: { currency_code: "EUR", value: "42.00" } }
          ]
        }
      }
    ]
  });

  assert.deepEqual(summary, {
    captureId: "CAPTURE-1",
    status: "COMPLETED",
    amountCents: 4200,
    currency: "EUR"
  });
});

test("PayPal capture validation rejects pending or financially divergent captures", () => {
  const pendingPayload = {
    purchase_units: [{ payments: { captures: [
      { id: "CAPTURE-PENDING", status: "PENDING", amount: { currency_code: "EUR", value: "99.00" } }
    ] } }]
  };
  assert.equal(extractCompletedCapture(pendingPayload), null);

  const completed = {
    captureId: "CAPTURE-OK",
    status: "COMPLETED",
    amountCents: 9900,
    currency: "EUR"
  };
  assert.equal(isExpectedCompletedCapture(completed, { amountCents: 9900, currency: "EUR" }), true);
  assert.equal(isExpectedCompletedCapture(completed, { amountCents: 100, currency: "EUR" }), false);
  assert.equal(isExpectedCompletedCapture(completed, { amountCents: 9900, currency: "USD" }), false);
  assert.equal(isExpectedCompletedCapture({ ...completed, status: "PENDING" }, { amountCents: 9900, currency: "EUR" }), false);
});

test("extractPayPalOrderIdFromWebhook supports order and capture webhooks", () => {
  assert.equal(extractPayPalOrderIdFromWebhook({
    event_type: "CHECKOUT.ORDER.APPROVED",
    resource: { id: "ORDER-1" }
  }), "ORDER-1");

  assert.equal(extractPayPalOrderIdFromWebhook({
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      supplementary_data: {
        related_ids: {
          order_id: "ORDER-2"
        }
      }
    }
  }), "ORDER-2");
});

test("getPayPalBaseUrl selects live and sandbox endpoints", () => {
  assert.equal(getPayPalBaseUrl("live"), "https://api-m.paypal.com");
  assert.equal(getPayPalBaseUrl("sandbox"), "https://api-m.sandbox.paypal.com");
});
