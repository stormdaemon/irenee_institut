import test from "node:test";
import assert from "node:assert/strict";
import {
  LIBRARY_MEMBERSHIP_AMOUNT_CENTS,
  LIBRARY_MEMBERSHIP_PRODUCT_ID,
  normalizeLibraryBookTitle
} from "./library";

test("library membership uses the fixed 15 euro price", () => {
  assert.equal(LIBRARY_MEMBERSHIP_AMOUNT_CENTS, 1500);
  assert.equal(LIBRARY_MEMBERSHIP_PRODUCT_ID, "apologetics-school-library");
});

test("normalizeLibraryBookTitle trims whitespace and requires a useful title", () => {
  assert.equal(normalizeLibraryBookTitle("  Le   Dieu un et trine  "), "Le Dieu un et trine");
  assert.throws(() => normalizeLibraryBookTitle(" "), /titre du livre/);
});

test("normalizeLibraryBookTitle limits titles stored for the direction", () => {
  assert.equal(normalizeLibraryBookTitle("a".repeat(240)).length, 180);
});
