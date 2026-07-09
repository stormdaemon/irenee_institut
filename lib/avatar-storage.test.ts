import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { avatarFilePath, normalizeAvatarImage } from "./avatar-storage";

const userId = "00000000-0000-4000-8000-000000000123";

test("avatar paths stay inside the configured absolute storage directory", () => {
  assert.equal(avatarFilePath("/var/lib/irenee/avatars", userId), `/var/lib/irenee/avatars/${userId}.webp`);
  assert.throws(() => avatarFilePath("../avatars", userId), /absolu/);
  assert.throws(() => avatarFilePath("/var/lib/irenee/avatars", "../../etc/passwd"), /identifiant/);
});

test("avatar images are decoded, resized and re-encoded as metadata-free WebP", async () => {
  const input = await sharp({
    create: { background: { alpha: 1, b: 180, g: 120, r: 40 }, channels: 4, height: 700, width: 900 }
  }).png().withExif({ IFD0: { Copyright: "secret test metadata" } }).toBuffer();

  const output = await normalizeAvatarImage(input);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok((metadata.width || 0) <= 512);
  assert.ok((metadata.height || 0) <= 512);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.ok(output.byteLength < input.byteLength);
});

test("avatar normalization rejects undecodable input", async () => {
  await assert.rejects(normalizeAvatarImage(Buffer.from("not an image")), /image/i);
});
