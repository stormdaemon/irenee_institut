import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stylesheet = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("PayPal hosted card frame keeps dark iframe labels readable", () => {
  const frameRule = stylesheet.match(/\.paypal-buttons-frame\s*\{([^}]*)\}/)?.[1] || "";

  assert.match(frameRule, /background:\s*#fff(?:fff)?\s*;/i);
  assert.match(frameRule, /color-scheme:\s*light\s*;/i);
});

test("auth browser autofill keeps readable dark-field contrast", () => {
  assert.match(stylesheet, /\.auth-input-wrap \.input:-webkit-autofill/);
  assert.match(stylesheet, /-webkit-text-fill-color:\s*#fff8e8\s*;/);
  assert.match(stylesheet, /box-shadow:\s*0 0 0 1000px #03111f inset\s*;/);
  assert.match(stylesheet, /\.auth-input-wrap \.input:autofill/);
});

test("onboarding keeps a scroll fallback and compacts on short desktop viewports", () => {
  const shellRule = stylesheet.match(/\.onboarding-shell\s*\{([^}]*)\}/)?.[1] || "";

  assert.match(shellRule, /height:\s*100dvh\s*;/);
  assert.match(shellRule, /overflow-y:\s*auto\s*;/);
  assert.match(stylesheet, /@media \(min-width: 981px\) and \(max-height: 820px\)/);
  assert.match(stylesheet, /\.onboarding-map button\s*\{[^}]*min-height:\s*34px\s*;/);
});
