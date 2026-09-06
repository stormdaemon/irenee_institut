import assert from "node:assert/strict";
import test from "node:test";
import { isExpectedStripeEventMode } from "./stripe";

test("Stripe mode must agree with the server key before grants or reversals", () => {
  assert.equal(isExpectedStripeEventMode({ livemode: true }, "sk_live_example"), true);
  assert.equal(isExpectedStripeEventMode({ livemode: false }, "rk_test_example"), true);
  for (const event of [{}, { livemode: false }, { livemode: "true" }, { livemode: true, data: { object: { livemode: false } } }]) {
    assert.equal(isExpectedStripeEventMode(event, "sk_live_example"), false);
  }
  assert.equal(isExpectedStripeEventMode({ livemode: true }, "unknown"), false);
  assert.equal(isExpectedStripeEventMode({ livemode: true }, "sk_test_example"), false);
});
