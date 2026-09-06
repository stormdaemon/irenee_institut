import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

const REPORT_PATH = "/etc/irenee/rapport-2026-07-15.html";
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

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
