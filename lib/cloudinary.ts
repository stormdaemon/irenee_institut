const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "da52mpv3g";

function encodePublicId(publicId: string) {
  return publicId.split("/").map(encodeURIComponent).join("/");
}

export function cloudinaryImageUrl(value?: string | null) {
  if (!value) return "";
  const src = value.trim();
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("/")) return src;
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${encodePublicId(src)}`;
}

export function cloudinaryAvatarUrl(value?: string | null, size = 256) {
  if (!value) return "";
  const src = value.trim();
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("/")) return src;
  const dimension = Math.max(96, Math.min(size, 512));
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,g_face,w_${dimension},h_${dimension},dpr_auto,f_auto,q_auto:best/${encodePublicId(src)}`;
}
