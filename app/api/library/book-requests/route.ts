import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { normalizeLibraryBookTitle } from "@/lib/library";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ["etudiant"]);
  if (!auth.ok) return auth.response;

  const { data: membership, error: membershipError } = await auth.supabase
    .from("library_memberships")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) return NextResponse.json({ ok: false, error: membershipError.message }, { status: 400 });
  if (!membership) return NextResponse.json({ ok: false, error: "Une adhesion active a la bibliotheque est requise." }, { status: 403 });

  try {
    const body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 8192);
    const requestedTitle = normalizeLibraryBookTitle(body.requestedTitle);
    const { data, error } = await auth.supabase
      .from("book_requests")
      .insert({
        course_id: null,
        library_membership_id: membership.id,
        requested_title: requestedTitle,
        status: "en_attente_direction",
        updated_at: new Date().toISOString(),
        user_id: auth.user.id
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Demande invalide." }, { status: 400 });
  }
}
