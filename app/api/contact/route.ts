import { NextResponse } from "next/server";
import { ContactInputError, parseContactInput } from "@/lib/contact";
import { sendContactMessage } from "@/lib/google-apps-script";
import { checkRateLimitHierarchy } from "@/lib/rate-limit";
import { readJsonBodyWithLimit, RequestBodyError } from "@/lib/request-body";
import { assertSameOrigin, getTrustedClientIp, RequestSecurityError } from "@/lib/request-security";

export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json(
      { error: "Requête refusée." },
      { headers: noStoreHeaders, status: error instanceof RequestSecurityError ? error.status : 403 }
    );
  }

  let input;
  try {
    const body = await readJsonBodyWithLimit<Record<string, unknown>>(request, 8_192);
    input = parseContactInput(body);
  } catch (error) {
    if (error instanceof RequestBodyError || error instanceof ContactInputError) {
      return NextResponse.json({ error: error.message }, { headers: noStoreHeaders, status: error.status });
    }
    return NextResponse.json({ error: "Message de contact invalide." }, { headers: noStoreHeaders, status: 400 });
  }

  const limits = await checkRateLimitHierarchy(
    { key: `contact:ip:${getTrustedClientIp(request)}`, limit: 5, windowMs: 15 * 60 * 1_000 },
    { key: `contact:email:${input.email}`, limit: 3, windowMs: 60 * 60 * 1_000 }
  );
  if (!limits.broad.allowed || !limits.specific?.allowed) {
    return NextResponse.json(
      { error: "Trop de messages. Réessayez plus tard." },
      {
        headers: {
          ...noStoreHeaders,
          "Retry-After": String(Math.max(limits.broad.retryAfterSeconds, limits.specific?.retryAfterSeconds || 0))
        },
        status: 429
      }
    );
  }

  // A filled honeypot receives the same public acknowledgement without
  // forwarding spam or revealing the filtering rule.
  if (input.website) {
    return NextResponse.json({ accepted: true }, { headers: noStoreHeaders, status: 202 });
  }

  try {
    await sendContactMessage(input);
    return NextResponse.json({ accepted: true }, { headers: noStoreHeaders, status: 202 });
  } catch {
    console.error("contact_message_delivery_failed");
    return NextResponse.json(
      { error: "Le message n’a pas pu être envoyé. Réessayez dans quelques instants." },
      { headers: noStoreHeaders, status: 503 }
    );
  }
}

