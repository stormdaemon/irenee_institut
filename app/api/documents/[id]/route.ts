import { NextResponse } from "next/server";
import { learningDocumentFilename, renderLearningDocumentSvg, type LearningDocument } from "@/lib/learning-documents";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ ok: false, error: "Connexion requise." }, { status: 401 });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ ok: false, error: "Session invalide." }, { status: 401 });

  const { id } = await params;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  const { data, error } = await supabase.from("learning_documents").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "Document introuvable." }, { status: 404 });
  if (data.user_id !== authData.user.id && profile?.role !== "directeur" && profile?.role !== "formateur") {
    return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 403 });
  }

  const document = data as LearningDocument;
  return new NextResponse(renderLearningDocumentSvg(document), {
    headers: {
      "Content-Disposition": `inline; filename="${learningDocumentFilename(document)}"`,
      "Content-Type": "image/svg+xml; charset=utf-8"
    }
  });
}

