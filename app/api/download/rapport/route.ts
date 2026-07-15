import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/request-security";

export const runtime = "nodejs";

const REPORT_PATH = "/etc/irenee/rapport-2026-07-15.html";
// SHA-256 du code d'accès communiqué séparément à la direction.
const ACCESS_CODE_SHA256 = "c81c4e9c1a53f3328755773163e45888379f48a52fa5e7a1e0ac1e3e7e363a0c";

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
    const limit = await checkRateLimit(`rapport-download:ip:${ip}`, 10, 10 * 60 * 1000);
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
    const report = await readFile(REPORT_PATH, "utf8");
    return new NextResponse(report, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Le rapport est momentanément indisponible." }, { status: 503 });
  }
}
