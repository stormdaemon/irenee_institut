import { readFileSync } from "node:fs";
import { Client } from "pg";
import { protectSettingValue } from "../lib/settings";

const allowed = new Set(["paymentProvider", "stripePublishableKey", "stripeSecretKey", "stripeWebhookSecret", "stripeWebhookUrl", "stripeLiteWebhookSecret", "stripeLiteWebhookUrl", "stripeApiVersion", "dailyApiKey", "adminEmail", "beneficiary", "iban", "bic", "rib"]);
const path = process.argv[2];
if (!path || !process.env.DATABASE_URL || !process.env.SETTINGS_ENCRYPTION_KEY) throw new Error("Private settings file and database environment required.");
const values = JSON.parse(readFileSync(path, "utf8"));
if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("Expected a settings object.");
if (Object.keys(values).some(key => !allowed.has(key))) throw new Error("Unexpected setting; import refused.");
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  for (const [key, value] of Object.entries(values)) {
    await client.query("insert into public.system_settings (key,value) values ($1,$2) on conflict (key) do nothing", [key, protectSettingValue(key, value)]);
  }
  await client.query("commit");
  console.log(`Imported ${Object.keys(values).length} provider settings; existing settings preserved, secrets encrypted.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally { await client.end(); }
