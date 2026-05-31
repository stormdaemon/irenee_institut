"use server";

import { capturePayPalOrder, createPayPalOrder, extractCompletedCapture, getPayPalConfig, normalizeBookTitle, parseEuroAmountToCents, PAYPAL_CURRENCY } from "@/lib/paypal";
import { ANNUAL_PASS_NAME, ANNUAL_PASS_PRODUCT_ID, ANNUAL_PASS_SLUG } from "@/lib/curriculum";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type CheckoutContext = {
  profile: Profile;
  supabase: NonNullable<ReturnType<typeof createServerClient>>;
  userId: string;
};

type CreateOrderInput = {
  amount: string;
  bookRequested: boolean;
  bookTitle: string;
  origin: string;
  token: string;
};

type CaptureOrderInput = {
  orderId: string;
  token: string;
};

async function getCheckoutContext(token: string): Promise<CheckoutContext | { error: string; status: number }> {
  const supabase = createServerClient();
  if (!supabase) return { error: "Le paiement est momentanement indisponible.", status: 501 };

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: authError?.message || "Session invalide ou expiree.", status: 401 };
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
  if (profileError) return { error: profileError.message, status: 400 };
  if (!profile) return { error: "Votre compte n'est pas pret pour l'achat. Reconnectez-vous puis reessayez.", status: 403 };

  return {
    profile: profile as Profile,
    supabase,
    userId: authData.user.id
  };
}

export async function getPayPalCheckoutConfigAction() {
  const supabase = createServerClient();
  if (!supabase) return { ok: false, error: "Le paiement est momentanement indisponible." };

  try {
    const config = getPayPalConfig(await getSystemSettings(supabase));
    if (!config.clientId) return { ok: false, error: "Le paiement PayPal n'est pas encore configure." };

    return {
      ok: true,
      clientId: config.clientId,
      currency: PAYPAL_CURRENCY,
      defaultAmount: "99.00",
      environment: config.environment
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Configuration PayPal indisponible." };
  }
}

export async function createPayPalOrderAction(input: CreateOrderInput) {
  try {
    const context = await getCheckoutContext(input.token);
    if ("error" in context) return { ok: false, error: context.error, status: context.status };

    const { profile, supabase, userId } = context;
    const { data: existingPass } = await supabase
      .from("annual_access_passes")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (existingPass) {
      return { ok: true, alreadyActive: true, redirectUrl: "/espace-etudiant" };
    }

    const settings = await getSystemSettings(supabase);
    const config = getPayPalConfig(settings);
    const amountCents = parseEuroAmountToCents(input.amount);
    const bookTitle = normalizeBookTitle(input.bookTitle, Boolean(input.bookRequested));
    const order = await createPayPalOrder({
      config,
      input: {
        amountCents,
        bookRequested: Boolean(input.bookRequested),
        course: {
          id: ANNUAL_PASS_PRODUCT_ID,
          slug: ANNUAL_PASS_SLUG,
          titre: ANNUAL_PASS_NAME
        },
        origin: input.origin || "https://irenee-institut.org",
        profile
      }
    });

    const { error: orderError } = await supabase.from("paypal_orders").upsert({
      order_id: String(order.id),
      user_id: userId,
      course_id: null,
      product_type: "annual_pass",
      amount_total: amountCents,
      currency: PAYPAL_CURRENCY,
      status: String(order.status || "CREATED").toLowerCase(),
      book_requested: Boolean(input.bookRequested),
      book_title: bookTitle || null,
      book_request_status: input.bookRequested ? "en_attente_direction" : "none",
      raw_order: order,
      updated_at: new Date().toISOString()
    }, { onConflict: "order_id" });

    if (orderError) throw new Error(orderError.message);

    return { ok: true, orderId: String(order.id) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "La commande PayPal n'a pas pu etre creee." };
  }
}

export async function capturePayPalOrderAction(input: CaptureOrderInput) {
  try {
    const supabase = createServerClient();
    if (!supabase) return { ok: false, error: "Le paiement est momentanement indisponible." };

    const { data: authData, error: authError } = await supabase.auth.getUser(input.token);
    if (authError || !authData.user) return { ok: false, error: authError?.message || "Session invalide ou expiree.", status: 401 };

    const { data: orderRow, error: orderError } = await supabase
      .from("paypal_orders")
      .select("*")
      .eq("order_id", input.orderId)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (orderError) return { ok: false, error: orderError.message };
    if (!orderRow) return { ok: false, error: "Commande PayPal introuvable pour ce compte." };

    const settings = await getSystemSettings(supabase);
    const capture = await capturePayPalOrder({ config: getPayPalConfig(settings), orderId: input.orderId });
    const summary = extractCompletedCapture(capture);

    if (!summary || summary.status !== "COMPLETED") {
      return { ok: false, error: "PayPal n'a pas confirme la capture du paiement." };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("validate_paypal_payment", {
      p_amount_total: summary.amountCents || Number(orderRow.amount_total || 0),
      p_book_requested: Boolean(orderRow.book_requested),
      p_book_title: String(orderRow.book_title || ""),
      p_capture_id: summary.captureId,
      p_course_id: orderRow.course_id,
      p_currency: summary.currency || PAYPAL_CURRENCY,
      p_event_name: "paypal_capture_completed",
      p_order_id: input.orderId,
      p_product_type: String(orderRow.product_type || "annual_pass"),
      p_raw_payload: capture,
      p_user_id: authData.user.id
    });

    if (rpcError) return { ok: false, error: rpcError.message };

    return {
      ok: true,
      data: rpcData,
      redirectUrl: `/paiement/merci?paypal_order_id=${encodeURIComponent(input.orderId)}`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Le paiement PayPal n'a pas pu etre capture.";
    return {
      ok: false,
      error: message,
      recoverable: message.includes("INSTRUMENT_DECLINED")
    };
  }
}
