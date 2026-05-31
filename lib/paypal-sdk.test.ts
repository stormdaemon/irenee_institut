import test from "node:test";
import assert from "node:assert/strict";
import { buildPayPalSdkUrl } from "./paypal-sdk";

test("buildPayPalSdkUrl renders checkout controls in French", () => {
  const url = new URL(buildPayPalSdkUrl({ clientId: "client-id", currency: "EUR" }));

  assert.equal(url.origin + url.pathname, "https://www.paypal.com/sdk/js");
  assert.equal(url.searchParams.get("client-id"), "client-id");
  assert.equal(url.searchParams.get("currency"), "EUR");
  assert.equal(url.searchParams.get("intent"), "capture");
  assert.equal(url.searchParams.get("components"), "buttons");
  assert.equal(url.searchParams.get("locale"), "fr_FR");
});
