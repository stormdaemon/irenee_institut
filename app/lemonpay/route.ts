import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getLemonConfig } from "@/lib/lemon-squeezy";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    id?: string;
    attributes?: Record<string, unknown>;
  };
};

function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  const digestBuffer = Buffer.from(digest, "hex");
  return signatureBuffer.length === digestBuffer.length && timingSafeEqual(signatureBuffer, digestBuffer);
}

function stringFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

async function logPaymentEvent(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  payload: LemonWebhookPayload,
  custom: Record<string, unknown>,
  status: string
) {
  const attributes = payload.data?.attributes || {};
  const eventName = stringFrom(payload.meta?.event_name);
  const eventId = stringFrom(payload.data?.id || attributes.identifier || attributes.order_number);

  await supabase.from("payment_events").upsert({
    provider: "lemon_squeezy",
    provider_event_id: eventId || `${eventName}-${Date.now()}`,
    event_name: eventName,
    user_id: stringFrom(custom.user_id) || null,
    course_id: stringFrom(custom.course_id) || null,
    order_id: stringFrom(payload.data?.id || attributes.identifier) || null,
    amount_total: Number(attributes.total || attributes.subtotal || 0),
    currency: stringFrom(attributes.currency || attributes.currency_code) || null,
    status,
    raw_payload: payload
  }, { onConflict: "provider,provider_event_id" });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "lemonpay" });
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });

  const rawBody = await request.text();
  const settings = await getSystemSettings(supabase);
  const { signingSecret } = getLemonConfig(settings);

  if (!verifySignature(rawBody, request.headers.get("x-signature"), signingSecret)) {
    return NextResponse.json({ ok: false, error: "Confirmation du paiement invalide." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as LemonWebhookPayload;
  const eventName = stringFrom(payload.meta?.event_name);
  const custom = payload.meta?.custom_data || {};
  const userId = stringFrom(custom.user_id);
  const courseId = stringFrom(custom.course_id);

  if (!["order_created", "subscription_created"].includes(eventName)) {
    await logPaymentEvent(supabase, payload, custom, "ignored").catch(() => undefined);
    return NextResponse.json({ ok: true, ignored: eventName || "unknown" });
  }

  if (!userId || !courseId) {
    await logPaymentEvent(supabase, payload, custom, "missing_custom_data").catch(() => undefined);
    return NextResponse.json({ ok: false, error: "Webhook reçu sans user_id/course_id." }, { status: 202 });
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (profileError || !profile) {
    await logPaymentEvent(supabase, payload, custom, "profile_not_found").catch(() => undefined);
    return NextResponse.json({ ok: false, error: profileError?.message || "Profil introuvable." }, { status: 202 });
  }

  const { data: course, error: courseError } = await supabase.from("courses").select("id").eq("id", courseId).maybeSingle();
  if (courseError || !course) {
    await logPaymentEvent(supabase, payload, custom, "course_not_found").catch(() => undefined);
    return NextResponse.json({ ok: false, error: courseError?.message || "Formation introuvable." }, { status: 202 });
  }

  const { error: enrollmentError } = await supabase
    .from("course_enrollments")
    .upsert({
      course_id: courseId,
      etudiant_id: userId,
      statut: "actif"
    }, { onConflict: "course_id,etudiant_id" });

  if (enrollmentError) {
    await logPaymentEvent(supabase, payload, custom, "enrollment_failed").catch(() => undefined);
    return NextResponse.json({ ok: false, error: enrollmentError.message }, { status: 500 });
  }

  await supabase
    .from("profiles")
    .update({
      statut_inscription: "validee",
      moyen_paiement: "lemon_squeezy",
      modalite_paiement: "paiement_en_ligne",
      formation_choisie: [courseId],
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  await logPaymentEvent(supabase, payload, custom, "validated").catch(() => undefined);

  return NextResponse.json({ ok: true, enrolled: true });
}
