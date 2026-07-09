"use server";

import { cookies } from "next/headers";
import { ANNUAL_PASS_NAME, ANNUAL_PASS_PRODUCT_ID, ANNUAL_PASS_SLUG } from "@/lib/curriculum";
import { SECURE_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, verifyAccessToken } from "@/lib/local-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSystemSettings } from "@/lib/settings";
import { createStripeCheckoutSession, getStripeConfig, normalizeStripeBookTitle, parseStripeAmountToCents, STRIPE_CURRENCY } from "@/lib/stripe";
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
};

async function getCheckoutContext(): Promise<CheckoutContext | { error: string; status: number }> {
  const supabase = createServerClient();
  if (!supabase) return { error: "Le paiement est momentanement indisponible.", status: 501 };

  const cookieStore = await cookies();
  const token = cookieStore.get(SECURE_SESSION_COOKIE_NAME)?.value || cookieStore.get(SESSION_COOKIE_NAME)?.value || "";
  const { user } = await verifyAccessToken(token);
  if (!user) return { error: "Session invalide ou expiree.", status: 401 };

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profileError) return { error: profileError.message, status: 400 };
  if (!profile) return { error: "Votre compte n'est pas pret pour l'achat. Reconnectez-vous puis reessayez.", status: 403 };

  return {
    profile: profile as Profile,
    supabase,
    userId: user.id
  };
}

export async function getStripeCheckoutConfigAction() {
  const supabase = createServerClient();
  if (!supabase) return { ok: false, error: "Le paiement est momentanement indisponible." };

  try {
    const config = getStripeConfig(await getSystemSettings(supabase));
    if (!config.secretKey) return { ok: false, error: "Le paiement Stripe n'est pas encore configure." };

    return {
      ok: true,
      currency: STRIPE_CURRENCY,
      defaultAmount: "99.00"
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Configuration Stripe indisponible." };
  }
}

export async function createStripeCheckoutSessionAction(input: CreateOrderInput) {
  try {
    const context = await getCheckoutContext();
    if ("error" in context) return { ok: false, error: context.error, status: context.status };

    const { profile, supabase, userId } = context;
    const limit = await checkRateLimit(`checkout:user:${userId}`, 5, 10 * 60 * 1000);
    if (!limit.allowed) {
      return {
        ok: false,
        error: "Trop de tentatives de paiement. Réessayez plus tard.",
        retryAfterSeconds: limit.retryAfterSeconds,
        status: 429
      };
    }
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
    const config = getStripeConfig(settings);
    const amountCents = parseStripeAmountToCents(input.amount);
    const bookTitle = normalizeStripeBookTitle(input.bookTitle, Boolean(input.bookRequested));
    const session = await createStripeCheckoutSession({
      config,
      input: {
        amountCents,
        bookRequested: Boolean(input.bookRequested),
        course: {
          id: ANNUAL_PASS_PRODUCT_ID,
          slug: ANNUAL_PASS_SLUG,
          titre: ANNUAL_PASS_NAME
        },
        origin: "https://irenee-institut.org",
        productType: "annual_pass",
        profile
      }
    });

    const { error: orderError } = await supabase.from("paypal_orders").upsert({
      order_id: String(session.id),
      provider: "stripe",
      user_id: userId,
      course_id: null,
      product_type: "annual_pass",
      amount_total: amountCents,
      currency: STRIPE_CURRENCY,
      status: String(session.status || "open").toLowerCase(),
      book_requested: Boolean(input.bookRequested),
      book_title: bookTitle || null,
      book_request_status: input.bookRequested ? "en_attente_direction" : "none",
      updated_at: new Date().toISOString()
    }, { onConflict: "order_id" });

    if (orderError) throw new Error("order_persistence_failed");

    return {
      ok: true,
      checkoutUrl: String(session.url),
      sessionId: String(session.id)
    };
  } catch (error) {
    console.error("stripe_checkout_action_failed", { error: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: "La session Stripe n'a pas pu être créée." };
  }
}
