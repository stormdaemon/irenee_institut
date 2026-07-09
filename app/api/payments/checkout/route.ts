import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { ANNUAL_PASS_NAME, ANNUAL_PASS_PRODUCT_ID, ANNUAL_PASS_SLUG } from "@/lib/curriculum";
import { getSystemSettings } from "@/lib/settings";
import { createStripeCheckoutSession, getStripeConfig, normalizeStripeBookTitle, parseStripeAmountToCents, STRIPE_CURRENCY } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import type { Profile } from "@/lib/types";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const limit = await checkRateLimit(`checkout:user:${user.id}`, 5, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Trop de tentatives de paiement. Réessayez plus tard." }, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
      status: 429
    });
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ ok: false, error: "Votre compte est momentanément indisponible." }, { status: 500 });
  if (!profile) return NextResponse.json({ ok: false, error: "Votre compte n'est pas prêt pour l'achat." }, { status: 403 });

  const { data: existingPass } = await supabase
    .from("annual_access_passes")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (existingPass) return NextResponse.json({ ok: true, alreadyActive: true, redirectUrl: "/espace-etudiant" });

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 16_384);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  try {
    const amountCents = parseStripeAmountToCents(body.amount);
    const bookTitle = normalizeStripeBookTitle(body.bookTitle, Boolean(body.bookRequested));
    const settings = await getSystemSettings(supabase);
    const session = await createStripeCheckoutSession({
      config: getStripeConfig(settings),
      input: {
        amountCents,
        bookRequested: Boolean(body.bookRequested),
        course: {
          id: ANNUAL_PASS_PRODUCT_ID,
          slug: ANNUAL_PASS_SLUG,
          titre: ANNUAL_PASS_NAME
        },
        origin: "https://irenee-institut.org",
        productType: "annual_pass",
        profile: profile as Profile
      }
    });

    const { error: orderError } = await supabase.from("paypal_orders").upsert({
      amount_total: amountCents,
      book_requested: Boolean(body.bookRequested),
      book_request_status: body.bookRequested ? "en_attente_direction" : "none",
      book_title: bookTitle || null,
      course_id: null,
      currency: STRIPE_CURRENCY,
      order_id: String(session.id),
      provider: "stripe",
      product_type: "annual_pass",
      status: String(session.status || "open").toLowerCase(),
      updated_at: new Date().toISOString(),
      user_id: user.id
    }, { onConflict: "order_id" });

    if (orderError) throw new Error("order_persistence_failed");
    return NextResponse.json({ ok: true, checkoutUrl: String(session.url), provider: "stripe", sessionId: String(session.id) });
  } catch (error) {
    console.error("stripe_checkout_failed", { error: error instanceof Error ? error.message : String(error), userId: user.id });
    return NextResponse.json({ ok: false, error: "Le paiement est momentanément indisponible." }, { status: 400 });
  }
}
