import { ANNUAL_PASS_NAME, ANNUAL_PASS_PRODUCT_ID, ANNUAL_PASS_SLUG } from "@/lib/curriculum";
import {
  LIBRARY_MEMBERSHIP_AMOUNT_CENTS,
  LIBRARY_MEMBERSHIP_NAME,
  LIBRARY_MEMBERSHIP_PRODUCT_ID,
  LIBRARY_MEMBERSHIP_SLUG
} from "@/lib/library";
import type { LocalServerClient, LocalServerUser } from "@/lib/local-server-client";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSystemSettings } from "@/lib/settings";
import {
  createStripeCheckoutSession,
  getStripeConfig,
  normalizeStripeBookTitle,
  parseStripeAmountToCents,
  STRIPE_CURRENCY
} from "@/lib/stripe";
import { isAllowedStripeCheckoutUrl } from "@/lib/stripe-checkout-url";
import type { Profile } from "@/lib/types";

export type CheckoutProductType = "annual_pass" | "library_membership";

export type CheckoutErrorCode =
  | "AUTH_REQUIRED"
  | "REQUEST_FORBIDDEN"
  | "SERVICE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "PROFILE_LOOKUP"
  | "PROFILE_MISSING"
  | "ROLE_FORBIDDEN"
  | "ENTITLEMENT_LOOKUP"
  | "STRIPE_CONFIG"
  | "STRIPE_API"
  | "ORDER_PERSISTENCE";

type CheckoutStage =
  | "authentication"
  | "validation"
  | "rate_limit"
  | "profile"
  | "entitlement"
  | "stripe_config"
  | "stripe_api"
  | "order_persistence";

type CheckoutInput = {
  amountCents: number;
  bookRequested: boolean;
  bookTitle: string;
};

type CheckoutSuccess = {
  ok: true;
  checkoutUrl: string;
  provider: "stripe";
  sessionId: string;
};

type AlreadyActive = {
  ok: true;
  alreadyActive: true;
  redirectUrl: "/espace-etudiant";
};

export type CheckoutResult = CheckoutSuccess | AlreadyActive;

const publicMessages: Record<CheckoutErrorCode, string> = {
  AUTH_REQUIRED: "Connexion requise.",
  REQUEST_FORBIDDEN: "Requête refusée.",
  SERVICE_UNAVAILABLE: "Le paiement est momentanément indisponible.",
  RATE_LIMITED: "Trop de tentatives de paiement. Réessayez plus tard.",
  INVALID_REQUEST: "Les informations de paiement sont invalides.",
  PROFILE_LOOKUP: "Votre compte est momentanément indisponible.",
  PROFILE_MISSING: "Votre profil n'a pas pu être préparé pour l'achat.",
  ROLE_FORBIDDEN: "Cette adhésion est réservée aux comptes étudiants.",
  ENTITLEMENT_LOOKUP: "Votre droit d'accès n'a pas pu être vérifié. Aucun paiement n'a été lancé.",
  STRIPE_CONFIG: "Le paiement Stripe n'est pas encore disponible.",
  STRIPE_API: "Stripe n'a pas pu préparer le paiement.",
  ORDER_PERSISTENCE: "La commande n'a pas pu être enregistrée. Aucun débit ne doit être poursuivi."
};

export class CheckoutServiceError extends Error {
  readonly code: CheckoutErrorCode;
  readonly retryAfterSeconds?: number;
  readonly stage: CheckoutStage;
  readonly status: number;

  constructor(
    code: CheckoutErrorCode,
    status: number,
    stage: CheckoutStage,
    options: { message?: string; retryAfterSeconds?: number } = {}
  ) {
    super(options.message || publicMessages[code]);
    this.name = "CheckoutServiceError";
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.stage = stage;
    this.status = status;
  }
}

export function checkoutErrorMessage(code: CheckoutErrorCode) {
  return publicMessages[code];
}

export function normalizeCheckoutError(error: unknown) {
  if (error instanceof CheckoutServiceError) return error;
  return new CheckoutServiceError("SERVICE_UNAVAILABLE", 503, "validation");
}

export function logCheckoutFailure(error: CheckoutServiceError, productType: CheckoutProductType, requestId: string) {
  console.error("stripe_checkout_failed", {
    code: error.code,
    productType,
    requestId,
    stage: error.stage
  });
}

function cleanProfileName(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function fallbackProfile(user: LocalServerUser): Profile {
  const metadata = user.user_metadata || {};
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) {
    throw new CheckoutServiceError("PROFILE_MISSING", 503, "profile");
  }

  return {
    email,
    id: user.id,
    nom: cleanProfileName(metadata.nom || metadata.last_name),
    prenom: cleanProfileName(metadata.prenom || metadata.first_name),
    role: "etudiant",
    statut_inscription: "en_attente"
  };
}

async function getOrRepairProfile(supabase: LocalServerClient, user: LocalServerUser) {
  const profileResult = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profileResult.error) {
    throw new CheckoutServiceError("PROFILE_LOOKUP", 503, "profile");
  }
  if (profileResult.data) return profileResult.data as Profile;

  const repair = fallbackProfile(user);
  const created = await supabase
    .from("profiles")
    .insert({ ...repair, updated_at: new Date().toISOString() })
    .select("*")
    .single();
  if (!created.error && created.data) return created.data as Profile;

  // A concurrent request may have repaired the same profile first.
  const concurrent = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!concurrent.error && concurrent.data) return concurrent.data as Profile;
  throw new CheckoutServiceError("PROFILE_MISSING", 503, "profile");
}

function normalizeInput(productType: CheckoutProductType, body: Record<string, unknown>): CheckoutInput {
  if (productType === "library_membership") {
    if (Object.keys(body).length > 0) {
      throw new CheckoutServiceError("INVALID_REQUEST", 400, "validation");
    }
    return {
      amountCents: LIBRARY_MEMBERSHIP_AMOUNT_CENTS,
      bookRequested: false,
      bookTitle: ""
    };
  }

  if (body.bookRequested !== undefined && typeof body.bookRequested !== "boolean") {
    throw new CheckoutServiceError("INVALID_REQUEST", 400, "validation");
  }
  if (body.bookTitle !== undefined && typeof body.bookTitle !== "string") {
    throw new CheckoutServiceError("INVALID_REQUEST", 400, "validation");
  }

  const bookRequested = body.bookRequested === true;
  try {
    return {
      amountCents: parseStripeAmountToCents(body.amount),
      bookRequested,
      bookTitle: normalizeStripeBookTitle(body.bookTitle, bookRequested)
    };
  } catch (error) {
    throw new CheckoutServiceError("INVALID_REQUEST", 400, "validation", {
      message: error instanceof Error ? error.message : publicMessages.INVALID_REQUEST
    });
  }
}

async function enforceRateLimit(productType: CheckoutProductType, userId: string) {
  const prefix = productType === "annual_pass" ? "checkout" : "library-checkout";
  let limit: Awaited<ReturnType<typeof checkRateLimit>>;
  try {
    limit = await checkRateLimit(`${prefix}:user:${userId}`, 5, 10 * 60 * 1000);
  } catch {
    throw new CheckoutServiceError("SERVICE_UNAVAILABLE", 503, "rate_limit");
  }
  if (!limit.allowed) {
    throw new CheckoutServiceError("RATE_LIMITED", 429, "rate_limit", {
      retryAfterSeconds: limit.retryAfterSeconds
    });
  }
}

async function hasActiveEntitlement(
  supabase: LocalServerClient,
  userId: string,
  productType: CheckoutProductType
) {
  const table = productType === "annual_pass" ? "annual_access_passes" : "library_memberships";
  const result = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new CheckoutServiceError("ENTITLEMENT_LOOKUP", 503, "entitlement");
  }
  return Boolean(result.data);
}

async function stripeConfig(supabase: LocalServerClient) {
  try {
    const config = getStripeConfig(await getSystemSettings(supabase));
    if (!config.secretKey) {
      throw new CheckoutServiceError("STRIPE_CONFIG", 503, "stripe_config");
    }
    return config;
  } catch (error) {
    if (error instanceof CheckoutServiceError) throw error;
    throw new CheckoutServiceError("STRIPE_CONFIG", 503, "stripe_config");
  }
}

export async function createCheckoutForUser({
  body,
  productType,
  requestId,
  supabase,
  user
}: {
  body: Record<string, unknown>;
  productType: CheckoutProductType;
  requestId: string;
  supabase: LocalServerClient;
  user: LocalServerUser;
}): Promise<CheckoutResult> {
  await enforceRateLimit(productType, user.id);
  const input = normalizeInput(productType, body);
  const profile = await getOrRepairProfile(supabase, user);

  if (productType === "library_membership" && profile.role !== "etudiant") {
    throw new CheckoutServiceError("ROLE_FORBIDDEN", 403, "profile");
  }
  if (await hasActiveEntitlement(supabase, user.id, productType)) {
    return { alreadyActive: true, ok: true, redirectUrl: "/espace-etudiant" };
  }

  const config = await stripeConfig(supabase);
  const isLibrary = productType === "library_membership";
  let session: Record<string, unknown>;
  try {
    session = await createStripeCheckoutSession({
      config,
      input: {
        amountCents: input.amountCents,
        bookRequested: input.bookRequested,
        bookTitle: input.bookTitle,
        cancelPath: isLibrary ? "/bibliotheque-apologetique?stripe_cancelled=1" : undefined,
        course: {
          id: isLibrary ? LIBRARY_MEMBERSHIP_PRODUCT_ID : ANNUAL_PASS_PRODUCT_ID,
          slug: isLibrary ? LIBRARY_MEMBERSHIP_SLUG : ANNUAL_PASS_SLUG,
          titre: isLibrary ? LIBRARY_MEMBERSHIP_NAME : ANNUAL_PASS_NAME
        },
        origin: "https://irenee-institut.org",
        productType,
        profile,
        returnPath: isLibrary
          ? "/paiement/merci?product=library-membership&stripe_session_id={CHECKOUT_SESSION_ID}"
          : undefined
      },
      requestId
    }) as Record<string, unknown>;
  } catch {
    throw new CheckoutServiceError("STRIPE_API", 502, "stripe_api");
  }

  if (!isAllowedStripeCheckoutUrl(session.url)) {
    throw new CheckoutServiceError("STRIPE_API", 502, "stripe_api");
  }

  const order = await supabase.from("paypal_orders").upsert({
    amount_total: input.amountCents,
    book_requested: input.bookRequested,
    book_request_status: input.bookRequested ? "en_attente_direction" : "none",
    book_title: input.bookTitle || null,
    course_id: null,
    currency: STRIPE_CURRENCY,
    order_id: String(session.id),
    product_type: productType,
    provider: "stripe",
    status: String(session.status || "open").toLowerCase(),
    updated_at: new Date().toISOString(),
    user_id: user.id
  }, { onConflict: "order_id" });

  if (order.error) {
    throw new CheckoutServiceError("ORDER_PERSISTENCE", 503, "order_persistence");
  }

  return {
    checkoutUrl: session.url,
    ok: true,
    provider: "stripe",
    sessionId: String(session.id)
  };
}
