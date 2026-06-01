import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { getCourses } from "@/lib/server-data";

function parseJsonArray(value: FormDataEntryValue | null) {
  if (!value) return [];
  try {
    return JSON.parse(String(value));
  } catch {
    return [];
  }
}

function toCents(value: FormDataEntryValue | null) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await getCourses());
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ["directeur", "formateur"]);
  if (!auth.ok) return auth.response;
  const { profile, supabase } = auth;
  if (!supabase) return NextResponse.json({ ok: false, error: "Le service est momentanément indisponible." }, { status: 501 });

  const form = await request.formData();
  const modules = parseJsonArray(form.get("modules"));
  const objectifs = parseJsonArray(form.get("objectifs"));
  const competences = parseJsonArray(form.get("competences"));
  const prerequis = parseJsonArray(form.get("prerequis"));
  const author = {
    auteur_id: profile.id,
    auteur_nom: `${profile.prenom || ""} ${profile.nom || ""}`.trim() || profile.email
  };
  const duration = Number(form.get("duree_totale_minutes") || form.get("duree_totale") || 0);

  const payload = {
    titre: String(form.get("titre") || ""),
    slug: String(form.get("slug") || ""),
    description: String(form.get("description") || ""),
    image_url: String(form.get("image_url") || "") || null,
    niveau: String(form.get("niveau") || "debutant"),
    objectifs,
    competences,
    prerequis,
    semestre: Number(form.get("semestre") || 1),
    numero: Number(form.get("numero") || 0),
    nb_modules: Number(form.get("nb_modules") || modules.length || 0),
    duree_totale_minutes: duration,
    duree_totale: duration,
    prix: toCents(form.get("prix")),
    prix_reduit: toCents(form.get("prix_reduit")),
    url_paiement_paypal: String(form.get("url_paiement_paypal") || "") || null,
    statut: String(form.get("statut") || "brouillon"),
    ...author
  };

  const { data, error } = await supabase.from("courses").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (Array.isArray(modules) && modules.length) {
    const rows = modules.map((module: Record<string, unknown>, index: number) => ({
      course_id: data.id,
      titre: String(module.titre || `Module ${index + 1}`),
      description: String(module.description || ""),
      ordre: Number(module.ordre || index + 1),
      duree: Number(module.duree || 0),
      type_contenu: String(module.type_contenu || module.type || "texte"),
      contenu_html: String(module.contenu_html || ""),
      contenu: String(module.contenu || module.contenu_html || "")
    }));
    const { error: moduleError } = await supabase.from("course_modules").insert(rows);
    if (moduleError) return NextResponse.json({ error: moduleError.message }, { status: 400 });
  }

  const { data: verifiedCourse, error: verifyError } = await supabase
    .from("courses")
    .select("*, course_modules(*)")
    .eq("id", data.id)
    .single();
  if (verifyError) return NextResponse.json({ ok: false, verified: false, error: verifyError.message }, { status: 400 });

  return NextResponse.json({ ok: true, verified: true, data: verifiedCourse });
}
