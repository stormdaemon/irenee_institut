import { NextResponse } from "next/server";
import { matchesDeclaredRecipient, normalizeDocumentReference } from "@/lib/document-verification";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { assertSameOrigin, getTrustedClientIp, RequestSecurityError } from "@/lib/request-security";
import { createServerClient } from "@/lib/supabase";

function invalidResult() {
  return NextResponse.json({ valid: false }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: error instanceof RequestSecurityError ? error.status : 403 });
  }
  const limit = await checkRateLimit(`document-verify:ip:${getTrustedClientIp(request)}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ valid: false, error: "Trop de vérifications." }, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
      status: 429
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 4096);
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ valid: false }, { status: error.status });
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  const reference = normalizeDocumentReference(body.reference);
  const recipient = String(body.recipient || "");
  if (!reference || !recipient || recipient.length > 240) return invalidResult();

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ valid: false, error: "Service indisponible." }, { status: 503 });
  const { data, error } = await supabase
    .from("learning_documents")
    .select("document_kind,document_number,recipient_name,issued_at,course_title,module_title")
    .eq("document_number", reference)
    .maybeSingle();
  if (error) return NextResponse.json({ valid: false, error: "Vérification indisponible." }, { status: 503 });
  if (!data || !matchesDeclaredRecipient(data.recipient_name, recipient)) return invalidResult();

  return NextResponse.json({
    valid: true,
    document: {
      courseTitle: data.course_title || null,
      issuedAt: data.issued_at,
      kind: data.document_kind,
      moduleTitle: data.module_title || null,
      reference: data.document_number
    }
  }, { headers: { "Cache-Control": "private, no-store" } });
}
