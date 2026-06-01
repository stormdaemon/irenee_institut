"use server";

import { capturePayPalOrder, createPayPalOrder, extractCompletedCapture, getPayPalConfig, PAYPAL_CURRENCY } from "@/lib/paypal";
import {
  LIBRARY_MEMBERSHIP_AMOUNT_CENTS,
  LIBRARY_MEMBERSHIP_NAME,
  LIBRARY_MEMBERSHIP_PRODUCT_ID,
  LIBRARY_MEMBERSHIP_SLUG
} from "@/lib/library";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type ActionInput = {
  token: string;
};

type CreateOrderInput = ActionInput & {
  origin: string;
};

type CaptureOrderInput = ActionInput & {
  orderId: string;
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

export async function getLibraryPayPalConfigAction() {
  const supabase = createServerClient();
  if (!supabase) return { ok: false, error: "Le paiement est momentanement indisponible." };

  try {
    const config = getPayPalConfig(await getSystemSettings(supabase));
    if (!config.clientId) return { ok: false, error: "Le paiement PayPal n'est pas encore configure." };
    return { ok: true, clientId: config.clientId, currency: PAYPAL_CURRENCY };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Configuration PayPal indisponible." };
  }
}

export async function createLibraryMembershipOrderAction(input: CreateOrderInput) {
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

    const config = getPayPalConfig(await getSystemSettings(context.supabase));
    const order = await createPayPalOrder({
      config,
      input: {
        amountCents: LIBRARY_MEMBERSHIP_AMOUNT_CENTS,
        bookRequested: false,
        cancelPath: "/bibliotheque-apologetique?paypal_cancelled=1",
        course: {
          id: LIBRARY_MEMBERSHIP_PRODUCT_ID,
          slug: LIBRARY_MEMBERSHIP_SLUG,
          titre: LIBRARY_MEMBERSHIP_NAME
        },
        origin: input.origin || "https://irenee-institut.org",
        profile: context.profile,
        returnPath: "/paiement/merci?product=library-membership"
      }
    });

    const { error: orderError } = await context.supabase.from("paypal_orders").upsert({
      amount_total: LIBRARY_MEMBERSHIP_AMOUNT_CENTS,
      book_requested: false,
      book_request_status: "none",
      course_id: null,
      currency: PAYPAL_CURRENCY,
      order_id: String(order.id),
      product_type: "library_membership",
      raw_order: order,
      status: String(order.status || "CREATED").toLowerCase(),
      updated_at: new Date().toISOString(),
      user_id: context.userId
    }, { onConflict: "order_id" });

    if (orderError) throw new Error(orderError.message);
    return { ok: true, orderId: String(order.id) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "La commande PayPal n'a pas pu etre creee." };
  }
}

export async function captureLibraryMembershipOrderAction(input: CaptureOrderInput) {
  try {
    const context = await getStudentContext(input.token);
    if ("error" in context) return { ok: false, error: context.error, status: context.status };

    const { data: orderRow, error: orderError } = await context.supabase
      .from("paypal_orders")
      .select("*")
      .eq("order_id", input.orderId)
      .eq("product_type", "library_membership")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (orderError) return { ok: false, error: orderError.message };
    if (!orderRow) return { ok: false, error: "Commande PayPal introuvable pour cette adhesion." };

    const config = getPayPalConfig(await getSystemSettings(context.supabase));
    const capture = await capturePayPalOrder({ config, orderId: input.orderId });
    const summary = extractCompletedCapture(capture);

    if (!summary || summary.status !== "COMPLETED") {
      return { ok: false, error: "PayPal n'a pas confirme la capture du paiement." };
    }

    const { data, error } = await context.supabase.rpc("validate_paypal_payment", {
      p_amount_total: summary.amountCents || Number(orderRow.amount_total || 0),
      p_book_requested: false,
      p_book_title: "",
      p_capture_id: summary.captureId,
      p_course_id: null,
      p_currency: summary.currency || PAYPAL_CURRENCY,
      p_event_name: "paypal_library_membership_capture_completed",
      p_order_id: input.orderId,
      p_product_type: "library_membership",
      p_raw_payload: capture,
      p_user_id: context.userId
    });

    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data,
      redirectUrl: "/paiement/merci?product=library-membership"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Le paiement PayPal n'a pas pu etre capture.";
    return { ok: false, error: message, recoverable: message.includes("INSTRUMENT_DECLINED") };
  }
}
