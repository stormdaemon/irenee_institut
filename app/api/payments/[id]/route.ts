import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { hashAuditSubject, recordSecurityEvent } from "@/lib/security-audit";

const allowedStatuses = new Set(["en_attente", "validee", "refusee"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ ok: false, error: "Utilisateur introuvable." }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 8192);
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const status = String(body.statut || "validee");
  if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "Statut de paiement invalide." }, { status: 400 });

  const { data, error } = await auth.supabase.from("profiles").update({
    statut_inscription: status,
    updated_at: new Date().toISOString()
  }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: "Le statut de paiement n'a pas pu être enregistré." }, { status: 500 });
  if (data.statut_inscription !== status) {
    return NextResponse.json({ ok: false, verified: false, error: "Payment status verification failed" }, { status: 409 });
  }
  await recordSecurityEvent({
    actorUserId: auth.user.id,
    eventType: status === "validee"
      ? "payment.manual.validated"
      : status === "refusee"
        ? "payment.manual.revoked"
        : "payment.manual.status_changed",
    metadata: { reason: status, route: "/api/payments/[id]", subject_hash: hashAuditSubject(id) },
    request
  });
  return NextResponse.json({ ok: true, verified: true, data });
}
