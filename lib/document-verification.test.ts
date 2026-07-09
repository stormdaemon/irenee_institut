import assert from "node:assert/strict";
import test from "node:test";
import { matchesDeclaredRecipient, normalizeDocumentReference } from "./document-verification";

test("document verification normalizes references and matches only the full declared name", () => {
  assert.equal(normalizeDocumentReference(" isi-abc123 "), "ISI-ABC123");
  assert.equal(normalizeDocumentReference("../../etc/passwd"), "");
  assert.equal(matchesDeclaredRecipient("  Élise   Martin ", "ÉLISE MARTIN"), true);
  assert.equal(matchesDeclaredRecipient("Élise Martin", "Élise M."), false);
});
