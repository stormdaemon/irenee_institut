import type { Course, Profile } from "@/lib/types";
import type { SystemSettings } from "@/lib/settings";
import { getCourseVariantId } from "@/lib/settings";

const lemonApiUrl = "https://api.lemonsqueezy.com/v1";

export type LemonConfig = {
  apiKey: string;
  storeId: string;
  signingSecret: string;
  webhookUrl: string;
};

export function getLemonConfig(settings: SystemSettings): LemonConfig {
  return {
    apiKey: String(settings.lemonApiKey || "").trim(),
    storeId: String(settings.lemonStoreId || "").trim(),
    signingSecret: String(settings.lemonSigningSecret || "").trim(),
    webhookUrl: String(settings.lemonWebhookUrl || "").trim()
  };
}

export function requireLemonCheckoutConfig(settings: SystemSettings, course: Pick<Course, "id" | "slug" | "titre">) {
  const config = getLemonConfig(settings);
  const variantId = getCourseVariantId(settings, course);

  if (!config.apiKey) throw new Error("Le paiement en ligne n'est pas encore disponible.");
  if (!config.storeId) throw new Error("Le paiement en ligne n'est pas encore disponible.");
  if (!variantId) throw new Error(`Le paiement n'est pas encore prêt pour la formation « ${course.titre} ».`);

  return { config, variantId };
}

export async function createLemonCheckout({
  settings,
  course,
  profile,
  origin
}: {
  settings: SystemSettings;
  course: Course;
  profile: Profile;
  origin: string;
}) {
  const { config, variantId } = requireLemonCheckoutConfig(settings, course);
  const fullName = `${profile.prenom || ""} ${profile.nom || ""}`.trim();
  const redirectUrl = `${origin}/paiement/merci?course=${encodeURIComponent(course.slug)}`;

  const response = await fetch(`${lemonApiUrl}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: profile.email,
            name: fullName || profile.email,
            custom: {
              user_id: profile.id,
              course_id: course.id,
              course_slug: course.slug,
              course_title: course.titre
            }
          },
          product_options: {
            redirect_url: redirectUrl
          }
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: config.storeId
            }
          },
          variant: {
            data: {
              type: "variants",
              id: variantId
            }
          }
        }
      }
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || "Le paiement n'a pas pu être préparé.";
    throw new Error(message);
  }

  const url = data?.data?.attributes?.url;
  if (!url) throw new Error("Le paiement n'a pas pu être préparé.");
  return {
    url: String(url),
    checkoutId: String(data.data.id || ""),
    variantId
  };
}

export async function fetchLemonStores(apiKey: string) {
  const response = await fetch(`${lemonApiUrl}/stores`, {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || "Connexion au service de paiement impossible.";
    throw new Error(message);
  }
  return data?.data || [];
}

export async function fetchLemonVariants(apiKey: string) {
  const response = await fetch(`${lemonApiUrl}/variants`, {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || "Les produits de paiement n'ont pas pu être chargés.";
    throw new Error(message);
  }
  return data?.data || [];
}
