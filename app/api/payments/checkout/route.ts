import { NextResponse } from "next/server";
import { createPayPalOrder, getPayPalConfig, normalizeBookTitle, parseEuroAmountToCents, PAYPAL_CURRENCY, PAYPAL_DEFAULT_AMOUNT_CENTS } from "@/lib/paypal";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";
import type { Course, Profile } from "@/lib/types";

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

export async function POST(request: Request) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le paiement est momentanement indisponible." }, { status: 501 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Connectez-vous avant d'acheter une formation." }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: authError?.message || "Session invalide ou expiree." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const courseId = String(body.courseId || body.courseSlug || "").trim();
  if (!courseId) return NextResponse.json({ ok: false, error: "Formation introuvable." }, { status: 400 });

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
  if (profileError) return NextResponse.json({ ok: false, error: profileError.message }, { status: 400 });
  if (!profile) return NextResponse.json({ ok: false, error: "Votre compte n'est pas pret pour l'achat. Reconnectez-vous puis reessayez." }, { status: 403 });

  const courseQuery = isUuid(courseId)
    ? supabase.from("courses").select("*").eq("id", courseId).maybeSingle()
    : supabase.from("courses").select("*").eq("slug", courseId).maybeSingle();
  const { data: course, error: courseError } = await courseQuery;

  if (courseError) return NextResponse.json({ ok: false, error: courseError.message }, { status: 400 });
  if (!course) return NextResponse.json({ ok: false, error: "Cette formation n'existe pas." }, { status: 404 });

  const { data: existingEnrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("etudiant_id", authData.user.id)
    .eq("course_id", course.id)
    .maybeSingle();

  if (existingEnrollment) {
    return NextResponse.json({ ok: true, alreadyEnrolled: true, redirectUrl: "/espace-etudiant" });
  }

  try {
    const amountCents = parseEuroAmountToCents(body.amount);
    const bookTitle = normalizeBookTitle(body.bookTitle, Boolean(body.bookRequested));
    const settings = await getSystemSettings(supabase);
    const origin = new URL(request.url).origin;
    const order = await createPayPalOrder({
      config: getPayPalConfig(settings),
      input: {
        amountCents,
        bookRequested: Boolean(body.bookRequested),
        course: normalizeCourse(course),
        origin,
        profile: profile as Profile
      }
    });

    const { error: orderError } = await supabase.from("paypal_orders").upsert({
      order_id: String(order.id),
      user_id: authData.user.id,
      course_id: course.id,
      amount_total: amountCents,
      currency: PAYPAL_CURRENCY,
      status: String(order.status || "CREATED").toLowerCase(),
      book_requested: Boolean(body.bookRequested),
      book_title: bookTitle || null,
      book_request_status: body.bookRequested ? "en_attente_direction" : "none",
      raw_order: order,
      updated_at: new Date().toISOString()
    }, { onConflict: "order_id" });

    if (orderError) throw new Error(orderError.message);

    return NextResponse.json({ ok: true, provider: "paypal", orderId: String(order.id) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Paiement indisponible." }, { status: 400 });
  }
}
