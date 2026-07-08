import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (id === auth.user.id) return NextResponse.json({ ok: false, error: "Vous ne pouvez pas supprimer votre propre compte administrateur." }, { status: 400 });

  const { error: profileError } = await auth.supabase.from("profiles").delete().eq("id", id);
  const deletedUser = await auth.supabase.auth.admin.deleteUser(id);
  const deletedUserError = (deletedUser as { error?: { message?: string } | null }).error;
  if (profileError || deletedUserError) return NextResponse.json({ error: profileError?.message || deletedUserError?.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
