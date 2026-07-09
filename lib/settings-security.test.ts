import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  isEncryptedSettingValue,
  protectSettingValue,
  unprotectSettingValue
} from "./settings";

const originalEncryptionKey = process.env.SETTINGS_ENCRYPTION_KEY;
const testEncryptionKey = Buffer.alloc(32, 0x5a).toString("base64");

afterEach(() => {
  if (originalEncryptionKey === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
  else process.env.SETTINGS_ENCRYPTION_KEY = originalEncryptionKey;
});

test("secret settings use randomized authenticated encryption at rest", () => {
  process.env.SETTINGS_ENCRYPTION_KEY = testEncryptionKey;

  const first = protectSettingValue("stripeSecretKey", "sk_test_sensitive");
  const second = protectSettingValue("stripeSecretKey", "sk_test_sensitive");

  assert.equal(isEncryptedSettingValue(first), true);
  assert.equal(isEncryptedSettingValue(second), true);
  assert.notEqual(first, second, "a fresh nonce must be used for every write");
  assert.equal(unprotectSettingValue("stripeSecretKey", first), "sk_test_sensitive");
  assert.equal(unprotectSettingValue("stripeSecretKey", second), "sk_test_sensitive");
  assert.equal(first.includes("sk_test_sensitive"), false);
});

test("ciphertexts are bound to their setting key and reject tampering", () => {
  process.env.SETTINGS_ENCRYPTION_KEY = testEncryptionKey;
  const protectedValue = protectSettingValue("stripeSecretKey", "sk_test_sensitive");
  const finalCharacter = protectedValue.at(-1) === "a" ? "b" : "a";
  const tampered = `${protectedValue.slice(0, -1)}${finalCharacter}`;

  assert.throws(() => unprotectSettingValue("paypalClientSecret", protectedValue), /déchiffr/i);
  assert.throws(() => unprotectSettingValue("stripeSecretKey", tampered), /déchiffr/i);
});

test("legacy plaintext remains readable during the explicit re-encryption rollout", () => {
  delete process.env.SETTINGS_ENCRYPTION_KEY;

  assert.equal(unprotectSettingValue("stripeSecretKey", "legacy-secret"), "legacy-secret");
  assert.deepEqual(unprotectSettingValue("publicConfiguration", "{\"enabled\":true}"), { enabled: true });
});

test("secret writes fail closed without an independent 256-bit key", () => {
  delete process.env.SETTINGS_ENCRYPTION_KEY;
  assert.throws(() => protectSettingValue("stripeSecretKey", "sk_test_sensitive"), /SETTINGS_ENCRYPTION_KEY/);

  process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
  assert.throws(() => protectSettingValue("stripeSecretKey", "sk_test_sensitive"), /32 octets/);
});

test("non-secret settings retain their normal serialized representation", () => {
  delete process.env.SETTINGS_ENCRYPTION_KEY;
  assert.equal(protectSettingValue("paypalEnvironment", "sandbox"), "sandbox");
  assert.equal(protectSettingValue("paypalDefaultAmountCents", 9900), "9900");
});
