import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { createHomework, HomeworkInputError, parseHomeworkForm } from "@/lib/homework-admin";
import { readFormDataBodyWithLimit, RequestBodyError } from "@/lib/request-body";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;
  let query = auth.supabase.from("homework").select("*, homework_assignments(*)").order("created_at", { ascending: false });
  if (auth.profile.role === "formateur") query = query.eq("auteur_id", auth.user.id);
  const { data, error } = await query;
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
