import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";

const allowedStatuses = new Set(["en_attente_direction", "approuve", "refuse"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 8192);
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const status = String(body.status || "").trim();
  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ ok: false, error: "Statut de demande invalide." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("book_requests")
    .update({
      status,
      reviewed_at: status === "en_attente_direction" ? null : new Date().toISOString(),
      reviewed_by: status === "en_attente_direction" ? null : auth.user.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  if (data.paypal_order_id) {
    await auth.supabase
      .from("paypal_orders")
      .update({
        book_request_status: status,
        updated_at: new Date().toISOString()
      })
      .eq("order_id", data.paypal_order_id);
  }

  return NextResponse.json({ ok: true, data });
}
