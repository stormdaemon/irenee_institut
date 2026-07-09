import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { readAvatarImage } from "@/lib/avatar-storage";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storageDirectory = String(process.env.AVATAR_STORAGE_DIR || "").trim();
  if (!storageDirectory || !UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  try {
    const image = await readAvatarImage(storageDirectory, id);
    const etag = `"${createHash("sha256").update(image).digest("base64url")}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { headers: { ETag: etag }, status: 304 });
    }
    return new NextResponse(image, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(image.byteLength),
        "Content-Type": "image/webp",
        "Cross-Origin-Resource-Policy": "same-origin",
        ETag: etag,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }
}
