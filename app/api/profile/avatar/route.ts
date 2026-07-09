import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { normalizeAvatarImage, storeAvatarImage } from "@/lib/avatar-storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { readFormDataBodyWithLimit, RequestBodyError } from "@/lib/request-body";

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidMagic(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (type === "image/webp") {
    return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  const limit = await checkRateLimit(`avatar:user:${auth.user.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Trop de photos envoyées. Réessayez plus tard." }, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
      status: 429
    });
  }

  let form: FormData;
  try {
    form = await readFormDataBodyWithLimit(request, MAX_AVATAR_BYTES + 16_384);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Envoi de photo invalide." }, { status: 400 });
  }
  const file = form?.get("file");
  if (!(file instanceof File) || file.size < 16 || file.size > MAX_AVATAR_BYTES || !allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "Utilisez une image JPEG, PNG ou WebP de 3 Mo maximum." }, { status: 400 });
  }
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidMagic(fileBytes.subarray(0, 16), file.type)) {
    return NextResponse.json({ error: "Le fichier ne correspond pas à un format d'image autorisé." }, { status: 400 });
  }

  const storageDirectory = String(process.env.AVATAR_STORAGE_DIR || "").trim();
  if (!storageDirectory) {
    return NextResponse.json({ error: "Le service photo est momentanément indisponible." }, { status: 503 });
  }

  try {
    const normalized = await normalizeAvatarImage(fileBytes);
    await storeAvatarImage(storageDirectory, auth.user.id, normalized);
    const avatarUrl = `/api/avatars/${auth.user.id}?v=${Date.now()}`;
    const { data, error } = await auth.supabase.from("profiles").update({
      avatar_public_id: null,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    }).eq("id", auth.user.id).select().single();
    if (error) throw new Error("profile_update_failed");
    return NextResponse.json({ ok: true, verified: true, data });
  } catch (error) {
    console.error("avatar_upload_failed", { error: error instanceof Error ? error.name : "unknown", userId: auth.user.id });
    return NextResponse.json({ error: "La photo n'a pas pu être enregistrée." }, { status: 502 });
  }
}
