import { NextResponse } from "next/server";
import { generatePayPalAccessToken, getPayPalConfig } from "@/lib/paypal";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";
import { authorizeDirector } from "@/lib/server-auth";

export async function GET(request: Request) {
  const auth = await authorizeDirector(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanement indisponible." }, { status: 501 });

  try {
    const settings = await getSystemSettings(supabase);
    const config = getPayPalConfig(settings);
    if (!config.clientId || !config.clientSecret) {
      return NextResponse.json({ ok: false, error: "Les identifiants PayPal sont manquants." }, { status: 400 });
    }

    await generatePayPalAccessToken(config);
    return NextResponse.json({
      ok: true,
      appName: config.appName,
      environment: config.environment,
      webhookConfigured: Boolean(config.webhookId),
      webhookUrl: config.webhookUrl
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "La verification PayPal est impossible." }, { status: 400 });
  }
}
