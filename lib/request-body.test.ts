import assert from "node:assert/strict";
import { test } from "node:test";
import {
  InvalidRequestBodyError,
  RequestBodyTooLargeError,
  UnsupportedMediaTypeError,
  readFormDataBodyWithLimit,
  readJsonBodyWithLimit
} from "./request-body";

test("bounded JSON parsing accepts a valid object", async () => {
  const request = new Request("https://irenee-institut.org/api/test", {
    body: JSON.stringify({ title: "Irénée" }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });

  assert.deepEqual(await readJsonBodyWithLimit(request, 128), { title: "Irénée" });
});

test("bounded JSON parsing rejects declared and streamed oversized bodies", async () => {
  const declared = new Request("https://irenee-institut.org/api/test", {
    body: "{}",
    headers: { "content-length": "200", "content-type": "application/json" },
    method: "POST"
  });
  await assert.rejects(readJsonBodyWithLimit(declared, 16), RequestBodyTooLargeError);

  const streamed = new Request("https://irenee-institut.org/api/test", {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value":"'));
        controller.enqueue(new TextEncoder().encode("x".repeat(64)));
        controller.enqueue(new TextEncoder().encode('"}'));
        controller.close();
      }
    }),
    duplex: "half",
    headers: { "content-type": "application/json" },
    method: "POST"
  } as RequestInit & { duplex: "half" });
  await assert.rejects(readJsonBodyWithLimit(streamed, 32), RequestBodyTooLargeError);
});

test("bounded parsers reject malformed input and unexpected media types", async () => {
  const malformed = new Request("https://irenee-institut.org/api/test", {
    body: "{not-json",
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  await assert.rejects(readJsonBodyWithLimit(malformed, 128), InvalidRequestBodyError);

  const wrongType = new Request("https://irenee-institut.org/api/test", {
    body: "{}",
    headers: { "content-type": "text/plain" },
    method: "POST"
  });
  await assert.rejects(readJsonBodyWithLimit(wrongType, 128), UnsupportedMediaTypeError);
});

test("bounded multipart parsing preserves text and file fields", async () => {
  const input = new FormData();
  input.set("title", "Cours mobile");
  input.set("asset", new File([new Uint8Array([1, 2, 3])], "asset.bin", { type: "application/octet-stream" }));
  const request = new Request("https://irenee-institut.org/api/test", { body: input, method: "POST" });

  const parsed = await readFormDataBodyWithLimit(request, 2048);
  assert.equal(parsed.get("title"), "Cours mobile");
  const file = parsed.get("asset");
  assert.ok(file instanceof File);
  assert.equal(file.size, 3);
});
