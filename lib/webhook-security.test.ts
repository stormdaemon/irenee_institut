import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { POST as paypalWebhook } from "@/app/paypal_checkout_valid/route";
import { handleStripeWebhookRequest } from "@/lib/stripe-webhook";
import { RequestBodyTooLargeError, readTextBodyWithLimit } from "./webhook-security";

test("readTextBodyWithLimit preserves the exact signed webhook payload", async () => {
  const payload = "{\"type\":\"checkout.session.completed\",\"é\":true}";
  const request = new Request("https://irenee.test/webhook", { body: payload, method: "POST" });
  assert.equal(await readTextBodyWithLimit(request, 256), payload);
});

test("readTextBodyWithLimit rejects declared and streamed oversized bodies", async () => {
  const declared = new Request("https://irenee.test/webhook", {
    body: "small",
    headers: { "content-length": "999" },
    method: "POST"
  });
  await assert.rejects(() => readTextBodyWithLimit(declared, 32), RequestBodyTooLargeError);

  const streamed = new Request("https://irenee.test/webhook", {
    body: "x".repeat(64),
    method: "POST"
  });
  await assert.rejects(() => readTextBodyWithLimit(streamed, 32), RequestBodyTooLargeError);
});

test("Stripe and PayPal webhooks enforce the bounded reader before parsing", () => {
  for (const path of ["lib/stripe-webhook.ts", "app/paypal_checkout_valid/route.ts"]) {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    assert.match(source, /readTextBodyWithLimit\(request\)/);
    assert.match(source, /RequestBodyTooLargeError/);
    assert.doesNotMatch(source, /request\.text\(\)/);
  }
});

test("payment webhooks never persist provider payloads", () => {
  for (const path of ["lib/stripe-webhook.ts", "app/paypal_checkout_valid/route.ts"]) {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    assert.doesNotMatch(source, /raw_payload\s*:\s*(?:event|payload|capture)/);
    assert.doesNotMatch(source, /raw_capture\s*:\s*(?:event|payload|capture)/);
    assert.doesNotMatch(source, /p_raw_payload\s*:\s*(?:event|payload|capture)/);
  }
});

test("provider calls happen only after local header checks and signature authentication", () => {
  const stripe = readFileSync(join(process.cwd(), "lib/stripe-webhook.ts"), "utf8");
  const paypal = readFileSync(join(process.cwd(), "app/paypal_checkout_valid/route.ts"), "utf8");
  assert.ok(stripe.indexOf("validateStripeWebhookHeader(") < stripe.indexOf("getSystemSettings(supabase)"));
  assert.ok(stripe.indexOf("verifyStripeWebhookSignature({") < stripe.indexOf("await resolveSessionSummary(config, event)"));
  assert.ok(paypal.indexOf("validatePayPalWebhookHeaders(request.headers)") < paypal.indexOf("verifyPayPalWebhookSignature({"));
  assert.ok(paypal.indexOf("verifyPayPalWebhookSignature({") < paypal.indexOf("capturePayPalOrder({"));
  assert.ok(paypal.indexOf('.select("provider,status")') < paypal.indexOf("capturePayPalOrder({"));
  assert.ok(stripe.indexOf('.eq("provider", "stripe")') < stripe.indexOf("await resolveSessionSummary(config, event)"));
});

test("payment validation, reversal, and manual decisions emit security audit events", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260709050000_payment_reversals.sql"), "utf8");
  const manualRoute = readFileSync(join(process.cwd(), "app/api/payments/[id]/route.ts"), "utf8");
  assert.match(migration, /payment\.webhook\.validated/);
  assert.match(migration, /payment\.webhook\.revoked/);
  assert.match(migration, /security_audit_events/);
  assert.match(manualRoute, /payment\.manual\.validated/);
  assert.match(manualRoute, /payment\.manual\.revoked/);
  assert.match(manualRoute, /recordSecurityEvent/);
});

test("oversized webhook requests return 413 before provider or database processing", async () => {
  const oversized = "x".repeat(512 * 1024 + 1);
  const stripe = await handleStripeWebhookRequest({
    lite: false,
    request: new Request("https://irenee.test/stripe_webhook", { body: oversized, method: "POST" }),
    supabase: new Proxy({}, {
      get() {
        throw new Error("Stripe oversized payload reached the database.");
      }
    }) as never
  });
  assert.equal(stripe.status, 413);

  const paypal = await paypalWebhook(new Request("https://irenee.test/paypal_checkout_valid", {
    body: oversized,
    method: "POST"
  }));
  assert.equal(paypal.status, 413);
});
