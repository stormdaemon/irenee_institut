const DEFAULT_JSON_LIMIT = 64 * 1024;

export class RequestBodyError extends Error {
  readonly status: number;

  constructor(message: string, status: number, name = "RequestBodyError") {
    super(message);
    this.name = name;
    this.status = status;
  }
}

export class RequestBodyTooLargeError extends RequestBodyError {

  constructor() {
    super("Corps de requête trop volumineux.", 413, "RequestBodyTooLargeError");
  }
}

export class InvalidRequestBodyError extends RequestBodyError {

  constructor(message = "Corps de requête invalide.") {
    super(message, 400, "InvalidRequestBodyError");
  }
}

export class UnsupportedMediaTypeError extends RequestBodyError {

  constructor() {
    super("Type de contenu non pris en charge.", 415, "UnsupportedMediaTypeError");
  }
}

function assertLimit(maxBytes: number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("maxBytes doit être un entier positif.");
  }
}

function declaredLength(request: Request) {
  const header = request.headers.get("content-length");
  if (header === null) return null;
  if (!/^\d+$/.test(header.trim())) throw new InvalidRequestBodyError();
  const length = Number(header);
  if (!Number.isSafeInteger(length) || length < 0) throw new InvalidRequestBodyError();
  return length;
}

export async function readRequestBodyWithLimit(request: Request, maxBytes: number) {
  assertLimit(maxBytes);
  const length = declaredLength(request);
  if (length !== null && length > maxBytes) throw new RequestBodyTooLargeError();
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function mediaType(request: Request) {
  return (request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
}

export async function readJsonBodyWithLimit<T = unknown>(request: Request, maxBytes = DEFAULT_JSON_LIMIT): Promise<T> {
  const type = mediaType(request);
  if (type !== "application/json" && !type.endsWith("+json")) throw new UnsupportedMediaTypeError();
  const bytes = await readRequestBodyWithLimit(request, maxBytes);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw error;
    throw new InvalidRequestBodyError();
  }
}

export async function readFormDataBodyWithLimit(request: Request, maxBytes: number) {
  const type = mediaType(request);
  if (type !== "multipart/form-data" && type !== "application/x-www-form-urlencoded") {
    throw new UnsupportedMediaTypeError();
  }
  const bytes = await readRequestBodyWithLimit(request, maxBytes);
  try {
    return await new Response(bytes, {
      headers: { "content-type": request.headers.get("content-type") || "" }
    }).formData();
  } catch {
    throw new InvalidRequestBodyError();
  }
}
