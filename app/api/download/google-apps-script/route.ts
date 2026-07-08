import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_SCRIPT_PATH = "/root/google-apps-script-worker.gs";

function sameCode(received: string, expected: string) {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const receivedCode = url.searchParams.get("code")?.trim() || "";
  const expectedCode = String(process.env.GOOGLE_APPS_SCRIPT_DOWNLOAD_CODE || "").trim();

  if (!sameCode(receivedCode, expectedCode)) {
    return new NextResponse("Code de téléchargement invalide.", {
      headers: { "Cache-Control": "no-store" },
      status: 401
    });
  }

  const scriptPath = process.env.GOOGLE_APPS_SCRIPT_DOWNLOAD_PATH || DEFAULT_SCRIPT_PATH;
  const script = await readFile(scriptPath, "utf8");

  return new NextResponse(script, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="institut-saint-irenee-google-apps-script.gs"',
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
