import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { getSystemSettings } from "@/lib/settings";
import { getStripeConfig, STRIPE_API_VERSION } from "@/lib/stripe";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  try {
    const settings = await getSystemSettings(auth.supabase);
    const config = getStripeConfig(settings);
    if (!config.secretKey) {
      return NextResponse.json({ ok: false, error: "La cle secrete Stripe est manquante." }, { status: 400 });
    }

    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Stripe-Version": config.apiVersion || STRIPE_API_VERSION
      }
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        error: data?.error?.message || "La verification Stripe est impossible."
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      apiVersion: config.apiVersion || STRIPE_API_VERSION,
      liteWebhookConfigured: Boolean(config.liteWebhookSecret),
      webhookConfigured: Boolean(config.webhookSecret)
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "La verification Stripe est impossible."
    }, { status: 400 });
  }
}
