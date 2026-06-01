import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.supabase.from("homework").select("*, homework_assignments(*)").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const studentIds = form.getAll("student_ids").map(String);
  const { supabase } = auth;
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });

  const { data: author, error: authorError } = await supabase
    .from("profiles")
    .select("id, prenom, nom, email")
    .in("role", ["directeur", "formateur"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (authorError || !author) {
    return NextResponse.json({ ok: false, verified: false, error: authorError?.message || "Aucun auteur administrateur trouvé pour créer le devoir." }, { status: 400 });
  }

  const { data, error } = await supabase.from("homework").insert({
    course_id: form.get("course_id"),
    titre: form.get("titre"),
    description: form.get("description"),
    auteur_id: author.id,
    auteur_nom: `${author.prenom || ""} ${author.nom || ""}`.trim() || author.email,
    date_limite: form.get("date_limite") || null
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (studentIds.length) {
    const { error: assignError } = await supabase.from("homework_assignments").insert(studentIds.map(student_id => ({
      homework_id: data.id,
      student_id
    })));
    if (assignError) return NextResponse.json({ error: assignError.message }, { status: 400 });
  }
  const { data: verifiedHomework, error: verifyError } = await supabase
    .from("homework")
    .select("*, homework_assignments(*)")
    .eq("id", data.id)
    .single();
  if (verifyError) return NextResponse.json({ ok: false, verified: false, error: verifyError.message }, { status: 400 });
  if ((verifiedHomework.homework_assignments?.length || 0) !== studentIds.length) {
    return NextResponse.json({ ok: false, verified: false, error: "Homework assignments verification failed" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, verified: true, data: verifiedHomework });
}
