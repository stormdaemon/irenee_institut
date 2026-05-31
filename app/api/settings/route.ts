import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { legalPages } from "@/lib/legal";
import { parseSettingValue, secretSettingKeys, stringifySettingValue } from "@/lib/settings";
import { PAYPAL_DEFAULT_AMOUNT_CENTS, PAYPAL_WEBHOOK_URL } from "@/lib/paypal";

const defaults = {
  rib: "",
  iban: "",
  bic: "",
  beneficiary: "Association Parole et Partage",
  adminEmail: "oeuvrecatholiquefrance@gmail.com",
  googleAppsScriptMailSecret: "",
  googleAppsScriptMailSecretConfigured: false,
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
  paypalDefaultAmountCents: PAYPAL_DEFAULT_AMOUNT_CENTS
};

async function upsertSystemSetting(supabase: NonNullable<ReturnType<typeof createServerClient>>, key: string, value: unknown) {
  const normalized = stringifySettingValue(value);
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

export async function GET() {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ...defaults, legalPages });

  const [{ data: settings }, { data: legalRows }] = await Promise.all([
    supabase.from("system_settings").select("*"),
    supabase.from("legal_pages").select("*")
  ]);

  const rawSettingsObject = Object.fromEntries((settings || []).map(item => [item.key, item.value]));
  const settingsObject = Object.fromEntries(Object.entries(rawSettingsObject).map(([key, value]) => [key, parseSettingValue(value)]));
  const legalObject = Object.fromEntries((legalRows || []).map(item => [item.slug, item.contenu]));
  const rib = String(settingsObject.rib || settingsObject.iban || "");
  return NextResponse.json({
    ...defaults,
    ...settingsObject,
    rib,
    iban: String(settingsObject.iban || rib),
    legalPages: legalObject,
    paypalClientId: "",
    paypalClientIdConfigured: Boolean(rawSettingsObject.paypalClientId),
    paypalClientIdPreview: "",
    paypalClientSecret: "",
    paypalClientSecretConfigured: Boolean(rawSettingsObject.paypalClientSecret),
    paypalClientSecretPreview: "",
    paypalWebhookId: "",
    paypalWebhookIdConfigured: Boolean(rawSettingsObject.paypalWebhookId),
    googleAppsScriptMailSecret: "",
    googleAppsScriptMailSecretConfigured: Boolean(rawSettingsObject.googleAppsScriptMailSecret)
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });

  try {
    const verified: Record<string, unknown> = {};

    if (body.legalPages && typeof body.legalPages === "object") {
      const legalResults = [];
      for (const [slug, contenu] of Object.entries(body.legalPages)) {
        const { data, error } = await supabase
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
      if (key === "legalPages") continue;
      if (secretSettingKeys.has(key) && typeof value === "string" && !value.trim()) continue;
      verified[key] = await upsertSystemSetting(supabase, key, value);
    }

    return NextResponse.json({ ok: true, verified: true, data: verified });
  } catch (error) {
    return NextResponse.json({ ok: false, verified: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
