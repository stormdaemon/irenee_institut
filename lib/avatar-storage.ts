import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import sharp from "sharp";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_INPUT_PIXELS = 25_000_000;

export class AvatarImageError extends Error {
  constructor(message = "Le fichier n'est pas une image valide.") {
    super(message);
    this.name = "AvatarImageError";
  }
}

export function avatarFilePath(storageDirectory: string, userId: string) {
  if (!storageDirectory || !isAbsolute(storageDirectory)) {
    throw new AvatarImageError("Le dossier de stockage des avatars doit être absolu.");
  }
  if (!UUID_PATTERN.test(userId)) throw new AvatarImageError("L'identifiant de l'avatar est invalide.");
  const root = resolve(storageDirectory);
  const target = resolve(join(root, `${userId}.webp`));
  if (!target.startsWith(`${root}${sep}`)) throw new AvatarImageError("Le chemin de l'avatar est invalide.");
  return target;
}

export async function normalizeAvatarImage(input: Uint8Array) {
  try {
    const { data, info } = await sharp(input, {
      animated: false,
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true
    })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention", withoutEnlargement: true })
      .webp({ effort: 5, quality: 84 })
      .toBuffer({ resolveWithObject: true });
    if (info.format !== "webp" || info.width < 1 || info.height < 1 || info.width > 512 || info.height > 512) {
      throw new Error("invalid output");
    }
    return data;
  } catch {
    throw new AvatarImageError();
  }
}

export async function storeAvatarImage(storageDirectory: string, userId: string, data: Uint8Array) {
  const target = avatarFilePath(storageDirectory, userId);
  const root = resolve(storageDirectory);
  await mkdir(root, { mode: 0o750, recursive: true });
  const temporary = join(root, `.${userId}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, data, { flag: "wx", mode: 0o640 });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
  return target;
}

export async function readAvatarImage(storageDirectory: string, userId: string) {
  return readFile(avatarFilePath(storageDirectory, userId));
}
