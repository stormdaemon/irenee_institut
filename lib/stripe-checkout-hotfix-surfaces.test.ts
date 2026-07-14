import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { POST as createAnnualPassCheckout } from "@/app/api/payments/checkout/route";
import { POST as createLibraryCheckout } from "@/app/api/payments/library/checkout/route";
import { isAllowedStripeCheckoutUrl } from "./stripe-checkout-url";
import { stripeCheckoutFailureStatus } from "./stripe-settlement";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function sourceWithDirectLocalImports(path: string) {
  const entryPath = join(process.cwd(), path);
  const entry = readFileSync(entryPath, "utf8");
  const imported = [...entry.matchAll(/from\s+["']([^"']+)["']/g)].flatMap(match => {
    const specifier = match[1];
    const base = specifier.startsWith("@/")
      ? join(process.cwd(), specifier.slice(2))
      : specifier.startsWith(".")
        ? resolve(dirname(entryPath), specifier)
        : "";
    if (!base) return [];

    const candidate = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]
      .find(file => existsSync(file));
    return candidate ? [readFileSync(candidate, "utf8")] : [];
  });
  return [entry, ...imported].join("\n");
}

async function json(response: Response) {
  return await response.json() as { code?: string; error?: string; ok?: boolean };
}

test("payment buttons use stable JSON checkout endpoints instead of Server Actions", () => {
  const annualPassButton = source("components/BuyCourseButton.tsx");
  const libraryButton = source("components/LibraryMembershipButton.tsx");

  for (const component of [annualPassButton, libraryButton]) {
    assert.doesNotMatch(component, /@\/app\/actions\//);
    assert.doesNotMatch(component, /CheckoutSessionAction/);
  }

  assert.match(
    annualPassButton,
    /fetch\(\s*["']\/api\/payments\/checkout["']\s*,\s*\{[\s\S]*?method:\s*["']POST["']/
  );
  assert.match(
    libraryButton,
    /fetch\(\s*["']\/api\/payments\/library\/checkout["']\s*,\s*\{[\s\S]*?method:\s*["']POST["']/
  );
});

test("checkout APIs return stable codes for anonymous and cross-site requests", async () => {
  const routes = [
    ["annual pass", createAnnualPassCheckout, "/api/payments/checkout"],
    ["library", createLibraryCheckout, "/api/payments/library/checkout"]
  ] as const;

  for (const [name, handler, pathname] of routes) {
    const anonymous = await handler(new Request(`https://irenee.test${pathname}`, {
      body: "{}",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }));
    assert.equal(anonymous.status, 401, `${name} anonymous status`);
    const anonymousBody = await json(anonymous);
    assert.equal(anonymousBody.ok, false);
    assert.equal(anonymousBody.code, "AUTH_REQUIRED");
    assert.ok(anonymousBody.error, `${name} anonymous error message`);

    const crossSite = await handler(new Request(`https://irenee.test${pathname}`, {
      body: "{}",
      headers: {
        "Content-Type": "application/json",
        Cookie: "irenee_session=invalid-test-session",
        Origin: "https://cross-site.invalid",
        "Sec-Fetch-Site": "cross-site"
      },
      method: "POST"
    }));
    assert.equal(crossSite.status, 403, `${name} cross-site status`);
    const crossSiteBody = await json(crossSite);
    assert.equal(crossSiteBody.ok, false);
    assert.equal(crossSiteBody.code, "REQUEST_FORBIDDEN");
    assert.ok(crossSiteBody.error, `${name} cross-site error message`);
  }
});

test("checkout failures expose the documented stable error-code vocabulary", () => {
  const implementation = [
    source("lib/stripe-checkout-service.ts"),
    source("lib/stripe-checkout-response.ts"),
    source("app/api/payments/checkout/route.ts"),
    source("app/api/payments/library/checkout/route.ts")
  ].join("\n");

  for (const code of [
    "AUTH_REQUIRED",
    "REQUEST_FORBIDDEN",
    "SERVICE_UNAVAILABLE",
    "RATE_LIMITED",
    "INVALID_REQUEST",
    "PROFILE_LOOKUP",
    "PROFILE_MISSING",
    "ROLE_FORBIDDEN",
    "ENTITLEMENT_LOOKUP",
    "STRIPE_CONFIG",
    "STRIPE_API",
    "ORDER_PERSISTENCE"
  ]) {
    assert.match(implementation, new RegExp(`\\b${code}\\b`), `missing checkout error code ${code}`);
  }

  assert.match(implementation, /code:\s*checkoutError\.code/);
  assert.match(implementation, /ok:\s*false/);
});

test("Stripe checkout redirect URLs require the exact hosted HTTPS origin", () => {
  for (const allowed of [
    "https://checkout.stripe.com/c/pay/cs_test_123",
    "https://checkout.stripe.com/pay/cs_live_123?prefilled_email=a%40example.test"
  ]) {
    assert.equal(isAllowedStripeCheckoutUrl(allowed), true, allowed);
  }

  for (const blocked of [
    "http://checkout.stripe.com/c/pay/cs_test_123",
    "https://checkout.stripe.com.evil.test/c/pay/cs_test_123",
    "https://evil.test/?next=https://checkout.stripe.com/c/pay/cs_test_123",
    "https://stripe.com/c/pay/cs_test_123",
    "https://checkout.stripe.com:444/c/pay/cs_test_123",
    "https://user@checkout.stripe.com/c/pay/cs_test_123",
    "//checkout.stripe.com/c/pay/cs_test_123",
    "not-a-url",
    ""
  ]) {
    assert.equal(isAllowedStripeCheckoutUrl(blocked), false, blocked);
  }
});

test("the thank-you page reconciles its Stripe session before declaring success", () => {
  const page = sourceWithDirectLocalImports("app/paiement/merci/page.tsx");

  assert.match(page, /stripe_session_id/);
  assert.match(page, /fetch\(\s*["']\/api\/payments\/stripe\/reconcile["']/);
  assert.match(page, /method:\s*["']POST["']/);
  assert.match(page, /JSON\.stringify\(\{\s*sessionId/);
  assert.match(page, /(?:(?:state|status)\s*===\s*["']active["']|case\s+["']active["'])[\s\S]{0,1600}Paiement confirm/);
  assert.doesNotMatch(page, /const\s+isLibraryMembership\s*=\s*product\s*===/);

  for (const status of ["active", "processing", "unpaid", "expired", "unknown"]) {
    assert.match(page, new RegExp(`["']${status}["']`), `missing thank-you state ${status}`);
  }
});

test("Stripe webhooks persist terminal states for expired and failed asynchronous checkouts", () => {
  const implementation = [
    source("lib/stripe-webhook.ts"),
    source("lib/stripe-settlement.ts")
  ].join("\n");

  assert.match(implementation, /checkout\.session\.expired/);
  assert.match(implementation, /checkout\.session\.async_payment_failed/);
  assert.equal(stripeCheckoutFailureStatus("checkout.session.expired"), "expired");
  assert.equal(stripeCheckoutFailureStatus("checkout.session.async_payment_failed"), "failed");
  assert.equal(stripeCheckoutFailureStatus("checkout.session.completed"), null);
  assert.match(implementation, /stripeCheckoutFailureStatus\(summary\.eventType\)/);
  assert.match(implementation, /const\s+failureUpdate\s*=[\s\S]{0,320}\{\s*status:\s*["']expired["'][\s\S]{0,220}:\s*\{\s*status:\s*["']failed["']/);
  assert.match(implementation, /from\(["']paypal_orders["']\)[\s\S]*?\.update\(failureUpdate\)/);
});
