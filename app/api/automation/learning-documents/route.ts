import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { renderLearningDocumentPdf } from "@/lib/learning-document-pdf";
import { learningDocumentFilename, type LearningDocument } from "@/lib/learning-documents";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";

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

async function authenticate(request: Request, supabase: NonNullable<ReturnType<typeof createServerClient>>) {
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const settings = await getSystemSettings(supabase);
  const expected = String(settings.googleAppsScriptMailSecret || process.env.GOOGLE_APPS_SCRIPT_MAIL_SECRET || "").trim();
  return sameSecret(received, expected);
}

export async function GET(request: Request) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });
  if (!await authenticate(request, supabase)) return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 401 });

  const { data, error } = await supabase
    .from("learning_documents")
    .select("*, profiles(email)")
    .eq("delivery_status", "queued")
    .order("issued_at", { ascending: true })
    .limit(100);

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
      htmlBody: `<p>Bonjour ${escapeHtml(document.recipient_name)},</p><p>Votre ${isCertificate ? "certificat nominatif d'apologétique" : "parchemin de connaissance"} délivré par l'Institut d'apologétique saint Irénée est joint à cet email.</p><p>Vous pouvez également le retrouver dans votre espace étudiant.</p>`,
      subject: isCertificate ? "Votre certificat nominatif d'apologétique" : "Votre parchemin de connaissance",
      to: String(email || "")
    };
  }));

  return NextResponse.json({ ok: true, jobs: jobs.filter(job => job.to) });
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });
  if (!await authenticate(request, supabase)) return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const documentId = String(body.documentId || "").trim();
  if (!documentId) return NextResponse.json({ ok: false, error: "documentId requis." }, { status: 400 });

  const sent = body.ok === true;
  const { data, error } = await supabase
    .from("learning_documents")
    .update({
      delivery_error: sent ? null : String(body.error || "Envoi Google Apps Script impossible."),
      delivery_status: sent ? "sent" : "queued",
      email_provider_id: body.providerId ? String(body.providerId) : null,
      emailed_at: sent ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", documentId)
    .select("id, delivery_status")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
