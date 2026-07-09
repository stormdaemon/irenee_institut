import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { createServerClient } from "@/lib/supabase";

const encryptedSettingPrefix = "enc:v1:";
const encryptionAlgorithm = "aes-256-gcm";

export const secretSettingKeys = new Set([
  "paypalClientId",
  "paypalClientSecret",
  "paypalWebhookId",
  "stripeLiteWebhookSecret",
  "stripeSecretKey",
  "stripeWebhookSecret",
  "googleAppsScriptMailSecret",
  "dailyApiKey"
]);

export type SystemSettings = Record<string, unknown>;

export function parseSettingValue(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

export function stringifySettingValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? "");
}

function settingsEncryptionKey() {
  const configured = String(process.env.SETTINGS_ENCRYPTION_KEY || "").trim();
  if (!configured) {
    throw new Error("SETTINGS_ENCRYPTION_KEY est requis pour enregistrer un paramètre secret.");
  }

  const decoded = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64url");
  if (decoded.length !== 32) {
    throw new Error("SETTINGS_ENCRYPTION_KEY doit décoder exactement 32 octets.");
  }
  return decoded;
}

function encryptionAssociatedData(key: string) {
  return Buffer.from(`irenee:system_settings:${key}`, "utf8");
}

export function isEncryptedSettingValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(encryptedSettingPrefix);
}

export function protectSettingValue(key: string, value: unknown) {
  const serialized = stringifySettingValue(value);
  if (!secretSettingKeys.has(key)) return serialized;

  const iv = randomBytes(12);
  const cipher = createCipheriv(encryptionAlgorithm, settingsEncryptionKey(), iv);
  cipher.setAAD(encryptionAssociatedData(key));
  const encrypted = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  return `${encryptedSettingPrefix}${iv.toString("base64url")}:${authenticationTag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function unprotectSettingValue(key: string, value: unknown) {
  if (!isEncryptedSettingValue(value)) return parseSettingValue(value);
  if (!secretSettingKeys.has(key)) {
    throw new Error("Valeur chiffrée associée à un paramètre non secret.");
  }

  const parts = value.split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Format de paramètre chiffré invalide.");
  }

  try {
    const iv = Buffer.from(parts[2], "base64url");
    const authenticationTag = Buffer.from(parts[3], "base64url");
    const ciphertext = Buffer.from(parts[4], "base64url");
    if (iv.length !== 12 || authenticationTag.length !== 16 || !ciphertext.length) {
      throw new Error("Invalid encrypted setting payload.");
    }
    const decipher = createDecipheriv(encryptionAlgorithm, settingsEncryptionKey(), iv);
    decipher.setAAD(encryptionAssociatedData(key));
    decipher.setAuthTag(authenticationTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return parseSettingValue(plaintext);
  } catch {
    throw new Error(`Le paramètre secret ${key} n'a pas pu être déchiffré.`);
  }
}

export function maskSecret(value: unknown) {
  const secret = String(value || "");
  if (!secret) return "";
  if (secret.length <= 12) return "••••••••";
  return `${secret.slice(0, 6)}••••••${secret.slice(-6)}`;
}

export async function getSystemSettings(supabase: NonNullable<ReturnType<typeof createServerClient>>): Promise<SystemSettings> {
  const { data, error } = await supabase.from("system_settings").select("*");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map(item => [item.key, unprotectSettingValue(item.key, item.value)]));
}
