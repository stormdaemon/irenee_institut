"use server";

import { capturePayPalOrder, createPayPalOrder, extractCompletedCapture, getPayPalConfig, normalizeBookTitle, parseEuroAmountToCents, PAYPAL_CURRENCY, PAYPAL_DEFAULT_AMOUNT_CENTS } from "@/lib/paypal";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";
import type { Course, Profile } from "@/lib/types";

type CheckoutContext = {
  course: Course;
  profile: Profile;
  supabase: NonNullable<ReturnType<typeof createServerClient>>;
  userId: string;
};

type CreateOrderInput = {
  amount: string;
  bookRequested: boolean;
  bookTitle: string;
  courseId: string;
  origin: string;
  token: string;
};

type CaptureOrderInput = {
  orderId: string;
  token: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeCourse(course: Record<string, unknown>): Course {
  return {
    id: String(course.id || ""),
    slug: String(course.slug || ""),
    titre: String(course.titre || ""),
    description: String(course.description || ""),
    image_url: course.image_url ? String(course.image_url) : null,
    niveau: String(course.niveau || "debutant"),
    duree_totale: Number(course.duree_totale_minutes || course.duree_totale || course.duree || 0),
    duree_totale_minutes: Number(course.duree_totale_minutes || course.duree_totale || course.duree || 0),
    nb_modules: Number(course.nb_modules || 0),
    nb_etudiants: Number(course.nb_etudiants || 0),
    prix: Number(course.prix || PAYPAL_DEFAULT_AMOUNT_CENTS),
    prix_reduit: Number(course.prix_reduit || 0),
    url_paiement_paypal: course.url_paiement_paypal ? String(course.url_paiement_paypal) : null,
    auteur_nom: course.auteur_nom ? String(course.auteur_nom) : undefined,
    statut: course.statut ? String(course.statut) : null,
    semestre: course.semestre ? Number(course.semestre) : null,
    numero: course.numero ? Number(course.numero) : null,
    objectifs: Array.isArray(course.objectifs) ? course.objectifs as string[] : [],
    competences: Array.isArray(course.competences) ? course.competences as string[] : [],
    prerequis: Array.isArray(course.prerequis) ? course.prerequis as string[] : [],
    modules: []
  };
}

async function getCheckoutContext(token: string, courseId: string): Promise<CheckoutContext | { error: string; status: number }> {
  const supabase = createServerClient();
  if (!supabase) return { error: "Le paiement est momentanement indisponible.", status: 501 };

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: authError?.message || "Session invalide ou expiree.", status: 401 };
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
  if (profileError) return { error: profileError.message, status: 400 };
  if (!profile) return { error: "Votre compte n'est pas pret pour l'achat. Reconnectez-vous puis reessayez.", status: 403 };

  const courseQuery = isUuid(courseId)
    ? supabase.from("courses").select("*").eq("id", courseId).maybeSingle()
    : supabase.from("courses").select("*").eq("slug", courseId).maybeSingle();
  const { data: course, error: courseError } = await courseQuery;

  if (courseError) return { error: courseError.message, status: 400 };
  if (!course) return { error: "Cette formation n'existe pas.", status: 404 };

  return {
    course: normalizeCourse(course),
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
    const context = await getCheckoutContext(input.token, input.courseId);
    if ("error" in context) return { ok: false, error: context.error, status: context.status };

    const { course, profile, supabase, userId } = context;
    const { data: existingEnrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("etudiant_id", userId)
      .eq("course_id", course.id)
      .maybeSingle();

    if (existingEnrollment) {
      return { ok: true, alreadyEnrolled: true, redirectUrl: "/espace-etudiant" };
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
        course,
        origin: input.origin || "https://irenee-institut.org",
        profile
      }
    });

    const { error: orderError } = await supabase.from("paypal_orders").upsert({
      order_id: String(order.id),
      user_id: userId,
      course_id: course.id,
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
      .select("*, courses(slug)")
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
      p_raw_payload: capture,
      p_user_id: authData.user.id
    });

    if (rpcError) return { ok: false, error: rpcError.message };

    const courseSlug = Array.isArray(orderRow.courses) ? orderRow.courses[0]?.slug : orderRow.courses?.slug;
    return {
      ok: true,
      data: rpcData,
      redirectUrl: `/paiement/merci?course=${encodeURIComponent(courseSlug || "")}&paypal_order_id=${encodeURIComponent(input.orderId)}`
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
