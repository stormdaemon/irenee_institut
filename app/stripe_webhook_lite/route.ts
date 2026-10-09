import { NextResponse } from "next/server";
import { handleStripeWebhookRequest } from "@/lib/stripe-webhook";
import { createServerContext } from "@/lib/postgres";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe_webhook_lite" });
}

export async function POST(request: Request) {
  const context = createServerContext();
  if (!context) {
    return NextResponse.json({ ok: false, error: "Le service est momentanement indisponible." }, { status: 501 });
  }
  return handleStripeWebhookRequest({ lite: true, request, context });
}
