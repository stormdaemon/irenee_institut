import { NextResponse } from "next/server";
import { ANNUAL_PASS_NAME, ANNUAL_PASS_PRODUCT_ID, ANNUAL_PASS_SLUG } from "@/lib/curriculum";
import { createPayPalOrder, getPayPalConfig, normalizeBookTitle, parseEuroAmountToCents, PAYPAL_CURRENCY } from "@/lib/paypal";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le paiement est momentanément indisponible." }, { status: 501 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ ok: false, error: "Connectez-vous avant d'obtenir le pass annuel." }, { status: 401 });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: authError?.message || "Session invalide ou expirée." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
  if (profileError) return NextResponse.json({ ok: false, error: profileError.message }, { status: 400 });
  if (!profile) return NextResponse.json({ ok: false, error: "Votre compte n'est pas prêt pour l'achat." }, { status: 403 });

  const { data: existingPass } = await supabase
    .from("annual_access_passes")
    .select("id")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (existingPass) return NextResponse.json({ ok: true, alreadyActive: true, redirectUrl: "/espace-etudiant" });

  const body = await request.json().catch(() => ({}));

  try {
    const amountCents = parseEuroAmountToCents(body.amount);
    const bookTitle = normalizeBookTitle(body.bookTitle, Boolean(body.bookRequested));
    const settings = await getSystemSettings(supabase);
    const order = await createPayPalOrder({
      config: getPayPalConfig(settings),
      input: {
        amountCents,
        bookRequested: Boolean(body.bookRequested),
        course: {
          id: ANNUAL_PASS_PRODUCT_ID,
          slug: ANNUAL_PASS_SLUG,
          titre: ANNUAL_PASS_NAME
        },
        origin: new URL(request.url).origin,
        profile: profile as Profile
      }
    });

    const { error: orderError } = await supabase.from("paypal_orders").upsert({
      amount_total: amountCents,
      book_requested: Boolean(body.bookRequested),
      book_request_status: body.bookRequested ? "en_attente_direction" : "none",
      book_title: bookTitle || null,
      course_id: null,
      currency: PAYPAL_CURRENCY,
      order_id: String(order.id),
      product_type: "annual_pass",
      raw_order: order,
      status: String(order.status || "CREATED").toLowerCase(),
      updated_at: new Date().toISOString(),
      user_id: authData.user.id
    }, { onConflict: "order_id" });

    if (orderError) throw new Error(orderError.message);
    return NextResponse.json({ ok: true, orderId: String(order.id), provider: "paypal" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Paiement indisponible." }, { status: 400 });
  }
}
