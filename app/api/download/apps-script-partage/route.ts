import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/request-security";

export const runtime = "nodejs";

const SCRIPT_PATH = "/etc/irenee/google-apps-script-worker.gs";
// SHA-256 du code d'accès communiqué séparément à la direction. Le code lui-même
// n'apparaît ni dans le dépôt ni sur le serveur.
const ACCESS_CODE_SHA256 = "cadf24546389a11851bd498e86ec9823a7c806f3fd4019079b3f658fb76bf97e";

function codeMatches(code: string) {
  if (!code) return false;
  const received = createHash("sha256").update(code).digest();
  const expected = Buffer.from(ACCESS_CODE_SHA256, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim() || "";
  if (!code) {
    return NextResponse.json({ ok: false, error: "Code d'accès requis." }, { status: 401 });
  }

  const ip = getTrustedClientIp(request);
  try {
    const limit = await checkRateLimit(`apps-script-partage:ip:${ip}`, 10, 10 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json({ ok: false, error: "Trop de tentatives. Réessayez plus tard." }, {
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
        status: 429
      });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 503 });
  }

  if (!codeMatches(code)) {
    return NextResponse.json({ ok: false, error: "Code d'accès invalide." }, { status: 401 });
  }

  try {
    const script = await readFile(SCRIPT_PATH, "utf8");
    return new NextResponse(script, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="institut-saint-irenee-google-apps-script.gs"',
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Le fichier technique est momentanément indisponible." }, { status: 503 });
  }
}
