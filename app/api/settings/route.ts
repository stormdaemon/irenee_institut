import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { legalPages } from "@/lib/legal";
import { protectSettingValue, secretSettingKeys, unprotectSettingValue } from "@/lib/settings";
import { PAYPAL_DEFAULT_AMOUNT_CENTS, PAYPAL_WEBHOOK_URL } from "@/lib/paypal";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { STRIPE_API_VERSION, STRIPE_LITE_WEBHOOK_URL, STRIPE_WEBHOOK_URL } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase";
import { recordSecurityEvent } from "@/lib/security-audit";

const defaults = {
  rib: "",
  iban: "",
  bic: "",
  beneficiary: "Association Parole et Partage",
  adminEmail: "oeuvrecatholiquefrance@gmail.com",
  googleAppsScriptMailSecret: "",
  googleAppsScriptMailSecretConfigured: false,
  dailyApiKey: "",
  dailyApiKeyConfigured: false,
  paypalAppName: "irenee_institut",
  paypalClientId: "",
  paypalClientIdConfigured: false,
  paypalClientIdPreview: "",
  paypalClientSecret: "",
  paypalClientSecretConfigured: false,
  paypalClientSecretPreview: "",
  paypalWebhookUrl: PAYPAL_WEBHOOK_URL,
  paypalWebhookId: "",
  paypalWebhookIdConfigured: false,
  paypalEnvironment: "live",
  paypalDefaultAmountCents: PAYPAL_DEFAULT_AMOUNT_CENTS,
  stripeApiVersion: STRIPE_API_VERSION,
  stripeLiteWebhookSecret: "",
  stripeLiteWebhookSecretConfigured: false,
  stripeLiteWebhookUrl: STRIPE_LITE_WEBHOOK_URL,
  stripePublishableKey: "",
  stripeSecretKey: "",
  stripeSecretKeyConfigured: false,
  stripeWebhookSecret: "",
  stripeWebhookSecretConfigured: false,
  stripeWebhookUrl: STRIPE_WEBHOOK_URL
};

const editableSettingKeys = new Set([
  "adminEmail",
  "beneficiary",
  "bic",
  "googleAppsScriptMailSecret",
  "iban",
  "paypalAppName",
  "paypalClientId",
  "paypalClientSecret",
  "paypalDefaultAmountCents",
  "paypalEnvironment",
  "paypalWebhookId",
  "paypalWebhookUrl",
  "rib",
  "stripeApiVersion",
  "stripeLiteWebhookSecret",
  "stripeLiteWebhookUrl",
  "stripePublishableKey",
  "stripeSecretKey",
  "stripeWebhookSecret",
  "stripeWebhookUrl"
]);

const editableLegalSlugs = new Set(Object.keys(legalPages));

async function upsertSystemSetting(supabase: NonNullable<ReturnType<typeof createServerClient>>, key: string, value: unknown) {
  const normalized = protectSettingValue(key, value);
  const { data: existing, error: selectError } = await supabase.from("system_settings").select("*").eq("key", key).maybeSingle();
  if (selectError) throw new Error(selectError.message);

  if (existing) {
    const { data, error } = await supabase
      .from("system_settings")
      .update({ value: normalized, updated_at: new Date().toISOString() })
      .eq("key", key)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase.from("system_settings").insert({ key, value: normalized }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  const [{ data: settings, error: settingsError }, { data: legalRows, error: legalError }] = await Promise.all([
    auth.supabase.from("system_settings").select("*"),
    auth.supabase.from("legal_pages").select("*")
  ]);
  if (settingsError || legalError) {
    console.error("admin_settings_read_failed", { legal: Boolean(legalError), settings: Boolean(settingsError) });
    return NextResponse.json({ error: "Les paramètres sont momentanément indisponibles." }, { status: 500 });
  }

  const rawSettingsObject = Object.fromEntries((settings || []).map(item => [item.key, item.value]));
  let settingsObject: Record<string, unknown>;
  try {
    settingsObject = Object.fromEntries(
      Object.entries(rawSettingsObject).map(([key, value]) => [key, unprotectSettingValue(key, value)])
    );
  } catch {
    console.error("admin_settings_decryption_failed");
    return NextResponse.json({ error: "Les paramètres secrets ne peuvent pas être déchiffrés." }, { status: 500 });
  }
  const legalObject = Object.fromEntries((legalRows || []).map(item => [item.slug, item.contenu]));
  const rib = String(settingsObject.rib || settingsObject.iban || "");
  const responseSettings: Record<string, unknown> = {
    ...defaults,
    ...settingsObject,
    rib,
    iban: String(settingsObject.iban || rib),
    legalPages: legalObject,
    paypalClientId: "",
    paypalClientIdConfigured: Boolean(settingsObject.paypalClientId),
    paypalClientIdPreview: "",
    paypalClientSecret: "",
    paypalClientSecretConfigured: Boolean(settingsObject.paypalClientSecret),
    paypalClientSecretPreview: "",
    paypalWebhookId: "",
    paypalWebhookIdConfigured: Boolean(settingsObject.paypalWebhookId),
    stripeLiteWebhookSecret: "",
    stripeLiteWebhookSecretConfigured: Boolean(settingsObject.stripeLiteWebhookSecret),
    stripeSecretKey: "",
    stripeSecretKeyConfigured: Boolean(settingsObject.stripeSecretKey),
    stripeWebhookSecret: "",
    stripeWebhookSecretConfigured: Boolean(settingsObject.stripeWebhookSecret),
    googleAppsScriptMailSecret: "",
    googleAppsScriptMailSecretConfigured: Boolean(settingsObject.googleAppsScriptMailSecret)
  };

  for (const key of secretSettingKeys) {
    responseSettings[key] = "";
    responseSettings[`${key}Configured`] = Boolean(settingsObject[key]);
  }

  return NextResponse.json(responseSettings, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 262_144);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  try {
    const verified: Record<string, unknown> = {};

    if (body.legalPages && typeof body.legalPages === "object") {
      const legalResults = [];
      for (const [slug, contenu] of Object.entries(body.legalPages)) {
        if (!editableLegalSlugs.has(slug)) continue;
        const { data, error } = await auth.supabase
          .from("legal_pages")
          .update({
            contenu: String(contenu),
            derniere_modification: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("slug", slug)
          .select()
          .single();
        if (error) throw new Error(error.message);
        legalResults.push(data);
      }
      verified.legalPages = legalResults;
    }

    for (const [key, value] of Object.entries(body)) {
      if (!editableSettingKeys.has(key)) continue;
      if (secretSettingKeys.has(key) && typeof value === "string" && !value.trim()) continue;
      await upsertSystemSetting(auth.supabase, key, value);
      verified[key] = true;
    }

    await recordSecurityEvent({
      actorUserId: auth.user.id,
      eventType: "admin.settings.updated",
      metadata: { route: "/api/settings" },
      request
    });

    return NextResponse.json(
      { ok: true, verified: true, data: verified },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    console.error("admin_settings_write_failed");
    return NextResponse.json(
      { ok: false, verified: false, error: "Les paramètres n'ont pas pu être enregistrés." },
      { status: 500 }
    );
  }
}
