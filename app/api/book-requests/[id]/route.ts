import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { authorizeDirector } from "@/lib/server-auth";

const allowedStatuses = new Set(["en_attente_direction", "approuve", "refuse"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDirector(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status || "").trim();

  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ ok: false, error: "Statut de demande invalide." }, { status: 400 });
  }

  const { supabase } = auth;
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanement indisponible." }, { status: 501 });

  const { data, error } = await supabase
    .from("book_requests")
    .update({
      status,
      reviewed_at: status === "en_attente_direction" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  if (data.paypal_order_id) {
    await supabase
      .from("paypal_orders")
      .update({
        book_request_status: status,
        updated_at: new Date().toISOString()
      })
      .eq("order_id", data.paypal_order_id);
  }

  return NextResponse.json({ ok: true, data });
}
