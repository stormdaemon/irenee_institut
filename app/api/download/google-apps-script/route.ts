import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api-auth";
import { recordSecurityEvent } from "@/lib/security-audit";

export const runtime = "nodejs";

const SCRIPT_PATH = "/etc/irenee/google-apps-script-worker.gs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ["directeur"]);
  if (!auth.ok) return auth.response;

  try {
    const script = await readFile(SCRIPT_PATH, "utf8");
    await recordSecurityEvent({
      actorUserId: auth.user.id,
      eventType: "admin.google_script.downloaded",
      metadata: { route: "/api/download/google-apps-script" },
      request
    });
    return new NextResponse(script, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="institut-saint-irenee-google-apps-script.gs"',
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Le fichier technique est momentanément indisponible." }, { status: 503 });
  }
}
