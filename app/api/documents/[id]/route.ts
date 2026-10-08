import { pgRead } from "@/lib/postgres";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { renderLearningDocumentPdf } from "@/lib/learning-document-pdf";
import { learningDocumentFilename, type LearningDocument } from "@/lib/learning-documents";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const { context, user } = auth;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "Document introuvable." }, { status: 404 });
  const { data: profile, error: profileError } = await pgRead("select t.\"role\" from public.\"profiles\" t where t.\"id\" = $1", [user.id], "optional");
  if (profileError || !profile) {
    return NextResponse.json({ ok: false, error: "L'autorisation ne peut pas être vérifiée." }, { status: 503 });
  }
  const { data, error } = await pgRead(
    'select * from public.learning_documents where id=$1 and ($2::boolean or user_id=$3)',
    [id, profile.role === "directeur", user.id], "optional");
  if (error) return NextResponse.json({ ok: false, error: "Document indisponible." }, { status: 503 });
  if (!data) return NextResponse.json({ ok: false, error: "Document introuvable." }, { status: 404 });

  const document = data as LearningDocument;
  return new NextResponse(Buffer.from(await renderLearningDocumentPdf(document)), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${learningDocumentFilename(document)}"`,
      "Content-Type": "application/pdf"
    }
  });
}
