"use server";

import { cookies } from "next/headers";
import {
  LIBRARY_MEMBERSHIP_AMOUNT_CENTS,
  LIBRARY_MEMBERSHIP_NAME,
  LIBRARY_MEMBERSHIP_PRODUCT_ID,
  LIBRARY_MEMBERSHIP_SLUG
} from "@/lib/library";
import { getSystemSettings } from "@/lib/settings";
import { SECURE_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, verifyAccessToken } from "@/lib/local-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createStripeCheckoutSession, getStripeConfig, STRIPE_CURRENCY } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

async function getStudentContext() {
  const supabase = createServerClient();
  if (!supabase) return { error: "Le paiement est momentanement indisponible.", status: 501 } as const;

  const cookieStore = await cookies();
  const token = cookieStore.get(SECURE_SESSION_COOKIE_NAME)?.value || cookieStore.get(SESSION_COOKIE_NAME)?.value || "";
  const { user } = await verifyAccessToken(token);
  if (!user) return { error: "Session invalide ou expiree.", status: 401 } as const;

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profileError) return { error: profileError.message, status: 400 } as const;
  if (!profile) return { error: "Votre compte etudiant n'est pas encore pret.", status: 403 } as const;
  if (profile.role !== "etudiant") return { error: "Cette adhesion est reservee aux comptes etudiants.", status: 403 } as const;

  return {
    profile: profile as Profile,
    supabase,
    userId: user.id
  };
}

export async function getLibraryStripeConfigAction() {
  const supabase = createServerClient();
  if (!supabase) return { ok: false, error: "Le paiement est momentanement indisponible." };

  try {
    const config = getStripeConfig(await getSystemSettings(supabase));
    if (!config.secretKey) return { ok: false, error: "Le paiement Stripe n'est pas encore configure." };
    return { ok: true, currency: STRIPE_CURRENCY };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Configuration Stripe indisponible." };
  }
}

export async function createLibraryMembershipCheckoutSessionAction() {
  try {
    const context = await getStudentContext();
    if ("error" in context) return { ok: false, error: context.error, status: context.status };

    const limit = await checkRateLimit(`library-checkout:user:${context.userId}`, 5, 10 * 60 * 1000);
    if (!limit.allowed) {
      return {
        ok: false,
        error: "Trop de tentatives de paiement. Réessayez plus tard.",
        retryAfterSeconds: limit.retryAfterSeconds,
        status: 429
      };
    }

    const { data: membership } = await context.supabase
      .from("library_memberships")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (membership) return { ok: true, alreadyActive: true, redirectUrl: "/espace-etudiant" };

    const config = getStripeConfig(await getSystemSettings(context.supabase));
    const session = await createStripeCheckoutSession({
      config,
      input: {
        amountCents: LIBRARY_MEMBERSHIP_AMOUNT_CENTS,
        bookRequested: false,
        cancelPath: "/bibliotheque-apologetique?stripe_cancelled=1",
        course: {
          id: LIBRARY_MEMBERSHIP_PRODUCT_ID,
          slug: LIBRARY_MEMBERSHIP_SLUG,
          titre: LIBRARY_MEMBERSHIP_NAME
        },
        origin: "https://irenee-institut.org",
        productType: "library_membership",
        profile: context.profile,
        returnPath: "/paiement/merci?product=library-membership&stripe_session_id={CHECKOUT_SESSION_ID}"
      }
    });

    const { error: orderError } = await context.supabase.from("paypal_orders").upsert({
      amount_total: LIBRARY_MEMBERSHIP_AMOUNT_CENTS,
      book_requested: false,
      book_request_status: "none",
      course_id: null,
      currency: STRIPE_CURRENCY,
      order_id: String(session.id),
      provider: "stripe",
      product_type: "library_membership",
      status: String(session.status || "open").toLowerCase(),
      updated_at: new Date().toISOString(),
      user_id: context.userId
    }, { onConflict: "order_id" });

    if (orderError) throw new Error("order_persistence_failed");
    return { ok: true, checkoutUrl: String(session.url), sessionId: String(session.id) };
  } catch (error) {
    console.error("library_checkout_action_failed", { error: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: "La session Stripe n'a pas pu être créée." };
  }
}
