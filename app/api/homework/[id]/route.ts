import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";

const editableFields = ["feedback", "grade", "statut"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const payload = Object.fromEntries(editableFields.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
  if (!Object.keys(payload).length) return NextResponse.json({ ok: false, error: "Aucune modification autorisee." }, { status: 400 });

  const { data, error } = await auth.supabase
    .from("homework_assignments")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true, data });
}
