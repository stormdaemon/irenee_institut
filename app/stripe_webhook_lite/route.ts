import { NextResponse } from "next/server";
import { handleStripeWebhookRequest } from "@/lib/stripe-webhook";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe_webhook_lite" });
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Le service est momentanement indisponible." }, { status: 501 });
  }
  return handleStripeWebhookRequest({ lite: true, request, supabase });
}
