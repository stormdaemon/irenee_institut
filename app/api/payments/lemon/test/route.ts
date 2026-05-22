import { NextResponse } from "next/server";
import { fetchLemonStores, fetchLemonVariants, getLemonConfig } from "@/lib/lemon-squeezy";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });

  try {
    const settings = await getSystemSettings(supabase);
    const config = getLemonConfig(settings);
    if (!config.apiKey) return NextResponse.json({ ok: false, error: "La clé de paiement est manquante." }, { status: 400 });

    const [stores, variants] = await Promise.all([
      fetchLemonStores(config.apiKey),
      fetchLemonVariants(config.apiKey)
    ]);

    return NextResponse.json({
      ok: true,
      storeCount: stores.length,
      variantCount: variants.length,
      suggestedStoreId: stores[0]?.id || "",
      variants: variants.slice(0, 12).map((variant: { id?: string; attributes?: Record<string, unknown> }) => ({
        id: variant.id,
        name: variant.attributes?.name,
        status: variant.attributes?.status,
        price: variant.attributes?.price_formatted || variant.attributes?.price
      }))
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "La vérification du paiement est impossible." }, { status: 400 });
  }
}
