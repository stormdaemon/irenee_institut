import { pgRead } from "@/lib/postgres";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { createHomework, HomeworkInputError, parseHomeworkForm } from "@/lib/homework-admin";
import { readFormDataBodyWithLimit, RequestBodyError } from "@/lib/request-body";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;
  const { data, error } = await pgRead(`select t.*,
    coalesce((select jsonb_agg(r) from public.homework_assignments r where r.homework_id=t.id), '[]'::jsonb) as homework_assignments
    from public.homework t where ($1::boolean or t.auteur_id=$2) order by t.created_at desc`,
    [auth.profile.role !== "formateur", auth.user.id]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  try {
    const form = await readFormDataBodyWithLimit(request, 256 * 1024);
    const data = await createHomework(parseHomeworkForm(form), {
      email: auth.profile.email,
      id: auth.profile.id,
      nom: auth.profile.nom,
      prenom: auth.profile.prenom,
      role: auth.profile.role as "directeur" | "formateur"
    });
    return NextResponse.json({ ok: true, verified: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof HomeworkInputError || error instanceof RequestBodyError) {
      return NextResponse.json({ ok: false, verified: false, error: error.message }, { status: error.status });
    }
    console.error("homework_create_failed", { actorUserId: auth.user.id });
    return NextResponse.json({ ok: false, verified: false, error: "Le devoir n'a pas pu être créé." }, { status: 500 });
  }
}
