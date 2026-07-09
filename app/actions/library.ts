"use server";

import {
  LIBRARY_MEMBERSHIP_AMOUNT_CENTS,
  LIBRARY_MEMBERSHIP_NAME,
  LIBRARY_MEMBERSHIP_PRODUCT_ID,
  LIBRARY_MEMBERSHIP_SLUG
} from "@/lib/library";
import { getSystemSettings } from "@/lib/settings";
import { createStripeCheckoutSession, getStripeConfig, STRIPE_CURRENCY } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type ActionInput = {
  token: string;
};

type CreateOrderInput = ActionInput & {
  origin: string;
};

async function getStudentContext(token: string) {
  const supabase = createServerClient();
  if (!supabase) return { error: "Le paiement est momentanement indisponible.", status: 501 } as const;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: authError?.message || "Session invalide ou expiree.", status: 401 } as const;
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
  if (profileError) return { error: profileError.message, status: 400 } as const;
  if (!profile) return { error: "Votre compte etudiant n'est pas encore pret.", status: 403 } as const;
  if (profile.role !== "etudiant") return { error: "Cette adhesion est reservee aux comptes etudiants.", status: 403 } as const;

  return {
    profile: profile as Profile,
    supabase,
    userId: authData.user.id
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

export async function createLibraryMembershipCheckoutSessionAction(input: CreateOrderInput) {
  try {
    const context = await getStudentContext(input.token);
    if ("error" in context) return { ok: false, error: context.error, status: context.status };

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
        origin: input.origin || "https://irenee-institut.org",
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
      raw_order: session,
      status: String(session.status || "open").toLowerCase(),
      updated_at: new Date().toISOString(),
      user_id: context.userId
    }, { onConflict: "order_id" });

    if (orderError) throw new Error(orderError.message);
    return { ok: true, checkoutUrl: String(session.url), sessionId: String(session.id) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "La session Stripe n'a pas pu etre creee." };
  }
}
