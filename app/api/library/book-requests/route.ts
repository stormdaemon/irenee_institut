import { pgInsert, pgRead } from "@/lib/postgres";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { normalizeLibraryBookTitle } from "@/lib/library";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ["etudiant"]);
  if (!auth.ok) return auth.response;

  const { data: membership, error: membershipError } = await pgRead("select t.* from public.\"library_memberships\" t where t.\"user_id\" = $1 and t.\"status\" = $2 and t.\"expires_at\" > $3 order by t.\"expires_at\" desc limit $4", [auth.user.id, "active", new Date().toISOString(), 1], "optional");

  if (membershipError) return NextResponse.json({ ok: false, error: membershipError.message }, { status: 400 });
  if (!membership) return NextResponse.json({ ok: false, error: "Une adhesion active a la bibliotheque est requise." }, { status: 403 });

  try {
    const body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 8192);
    const requestedTitle = normalizeLibraryBookTitle(body.requestedTitle);
    const { data, error } = await pgInsert("book_requests", {
        course_id: null,
        library_membership_id: membership.id,
        requested_title: requestedTitle,
        status: "en_attente_direction",
        updated_at: new Date().toISOString(),
        user_id: auth.user.id
      }, { returning: "one" });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Demande invalide." }, { status: 400 });
  }
}
