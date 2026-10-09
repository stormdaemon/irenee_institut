import { pgRead, pgUpdate } from "@/lib/postgres";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { renderLearningDocumentPdf } from "@/lib/learning-document-pdf";
import { learningDocumentFilename, type LearningDocument } from "@/lib/learning-documents";
import { getSystemSettings } from "@/lib/settings";
import { createServerContext } from "@/lib/postgres";

export const runtime = "nodejs";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sameSecret(received: string, expected: string) {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function authenticate(request: Request, context: NonNullable<ReturnType<typeof createServerContext>>) {
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const settings = await getSystemSettings(context);
  const expected = String(settings.googleAppsScriptMailSecret || process.env.GOOGLE_APPS_SCRIPT_MAIL_SECRET || "").trim();
  return sameSecret(received, expected);
}

export async function GET(request: Request) {
  const context = createServerContext();
  if (!context) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });
  if (!await authenticate(request, context)) return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 401 });

  const { data, error } = await pgRead("select t.*, (select to_jsonb(nested) from (select r.\"email\" from public.\"profiles\" r where r.\"id\" = t.\"user_id\" limit 1) nested) as \"profiles\" from public.\"learning_documents\" t where t.\"delivery_status\" = $1 order by t.\"issued_at\" asc limit $2", ["queued", 20], "many");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const jobs = await Promise.all((data || []).map(async row => {
    const document = row as LearningDocument;
    const email = Array.isArray(row.profiles) ? row.profiles[0]?.email : row.profiles?.email;
    const isCertificate = document.document_kind === "final_certificate";
    const pdf = await renderLearningDocumentPdf(document);
    return {
      attachmentBase64: Buffer.from(pdf).toString("base64"),
      attachmentMimeType: "application/pdf",
      documentId: document.id,
      filename: learningDocumentFilename(document),
      htmlBody: `<p>Bonjour ${escapeHtml(document.recipient_name)},</p><p>Votre ${isCertificate ? "certificat nominatif d'apologétique" : "parchemin de connaissance"} délivré par l'Institut Apostolos Saint Irénée est joint à cet email.</p><p>Vous pouvez également le retrouver dans votre espace étudiant.</p>`,
      subject: isCertificate ? "Votre certificat nominatif d'apologétique" : "Votre parchemin de connaissance",
      to: String(email || "")
    };
  }));

  return NextResponse.json({ ok: true, jobs: jobs.filter(job => job.to) });
}

export async function POST(request: Request) {
  const context = createServerContext();
  if (!context) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });
  if (!await authenticate(request, context)) return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const documentId = String(body.documentId || "").trim();
  if (!documentId) return NextResponse.json({ ok: false, error: "documentId requis." }, { status: 400 });

  const sent = body.ok === true;
  const { data, error } = await pgUpdate("learning_documents", {
      delivery_error: sent ? null : String(body.error || "Envoi Google Apps Script impossible."),
      delivery_status: sent ? "sent" : "queued",
      email_provider_id: body.providerId ? String(body.providerId) : null,
      emailed_at: sent ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }, "t.\"id\" = $1", [documentId], { returning: "one", columns: "id, delivery_status" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
