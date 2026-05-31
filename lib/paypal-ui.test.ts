import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stylesheet = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("PayPal hosted card frame keeps dark iframe labels readable", () => {
  const frameRule = stylesheet.match(/\.paypal-buttons-frame\s*\{([^}]*)\}/)?.[1] || "";

  assert.match(frameRule, /background:\s*#fff(?:fff)?\s*;/i);
  assert.match(frameRule, /color-scheme:\s*light\s*;/i);
});
