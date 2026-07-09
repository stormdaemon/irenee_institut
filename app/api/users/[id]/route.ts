import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { hashAuditSubject, recordSecurityEvent } from "@/lib/security-audit";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ ok: false, error: "Utilisateur introuvable." }, { status: 404 });
  if (id === auth.user.id) return NextResponse.json({ ok: false, error: "Vous ne pouvez pas supprimer votre propre compte administrateur." }, { status: 400 });

  const deletedUser = await auth.supabase.auth.admin.deleteUser(id);
  const deletedUserError = (deletedUser as { error?: { message?: string } | null }).error;
  if (deletedUserError) {
    console.error("admin_user_delete_failed", { actorUserId: auth.user.id });
    return NextResponse.json({ error: "Le compte n'a pas pu être supprimé." }, { status: 500 });
  }
  await recordSecurityEvent({
    actorUserId: auth.user.id,
    eventType: "admin.user.deleted",
    metadata: { route: "/api/users/[id]", subject_hash: hashAuditSubject(id) },
    request
  });
  return NextResponse.json({ ok: true });
}
