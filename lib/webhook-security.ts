export const MAX_WEBHOOK_BODY_BYTES = 512 * 1024;

export class RequestBodyTooLargeError extends Error {
  readonly status = 413;

  constructor() {
    super("Corps de requête trop volumineux.");
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readTextBodyWithLimit(request: Request, maxBytes = MAX_WEBHOOK_BODY_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("maxBytes doit être un entier positif.");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}
