import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { HomeworkInputError, parseHomeworkReview, reviewHomeworkAssignment } from "@/lib/homework-admin";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 16 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  try {
    const data = await reviewHomeworkAssignment(id, parseHomeworkReview(body), {
      email: auth.profile.email,
      id: auth.profile.id,
      nom: auth.profile.nom,
      prenom: auth.profile.prenom,
      role: auth.profile.role as "directeur" | "formateur"
    });
    return NextResponse.json({ ok: true, verified: true, data });
  } catch (error) {
    if (error instanceof HomeworkInputError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("homework_review_failed", { actorUserId: auth.user.id });
    return NextResponse.json({ ok: false, error: "La correction n'a pas pu être enregistrée." }, { status: 500 });
  }
}
