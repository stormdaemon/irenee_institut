import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import type { ParsedCourseModule } from "./course-input";
import { validatePublishedCaptionResources } from "./course-caption-validation";

const temporaryDirectories: string[] = [];
const validVtt = "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nBienvenue.\n";

function publishedInput(captionsUrl: string) {
  return {
    course: { statut: "publie" },
    modules: [{
      titre: "Module vidéo",
      description: "",
      contenu: "",
      contenu_html: "",
      duree: 10,
      ordre: 1,
      type_contenu: "video",
      url_video: "/video.mp4",
      url_sous_titres: captionsUrl,
    } satisfies ParsedCourseModule],
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })));
});

test("published captions require the controlled Cloudinary host, text/vtt and actual WEBVTT cues", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return new Response(validVtt, { headers: { "content-type": "text/vtt; charset=utf-8" } });
  };

  await validatePublishedCaptionResources(
    publishedInput("https://res.cloudinary.com/da52mpv3g/raw/upload/course-fr.vtt") as never,
    { fetchImpl },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.init?.redirect, "error");
  assert.equal(calls[0]?.init?.credentials, "omit");
  assert.ok(calls[0]?.init?.signal instanceof AbortSignal);

  await assert.rejects(
    validatePublishedCaptionResources(
      publishedInput("https://attacker.example/course-fr.vtt") as never,
      { fetchImpl },
    ),
    /adresse.*contrôlée/i,
  );
  assert.equal(calls.length, 1, "an untrusted host must never be fetched");

  await assert.rejects(
    validatePublishedCaptionResources(
      publishedInput("https://res.cloudinary.com/da52mpv3g/raw/upload/fake.vtt") as never,
      { fetchImpl: async () => new Response(validVtt, { headers: { "content-type": "text/html" } }) },
    ),
    /type MIME text\/vtt/i,
  );

  await assert.rejects(
    validatePublishedCaptionResources(
      publishedInput("https://res.cloudinary.com/da52mpv3g/raw/upload/fake.vtt") as never,
      { fetchImpl: async () => new Response("<html>WEBVTT</html>", { headers: { "content-type": "text/vtt" } }) },
    ),
    /contenu WebVTT valide/i,
  );
});

test("remote caption downloads are bounded by declared and streamed size", async () => {
  const url = "https://res.cloudinary.com/da52mpv3g/raw/upload/large.vtt";
  await assert.rejects(
    validatePublishedCaptionResources(publishedInput(url) as never, {
      fetchImpl: async () => new Response(validVtt, {
        headers: { "content-length": "9999999", "content-type": "text/vtt" },
      }),
      maxBytes: 64,
    }),
    /trop volumineux/i,
  );

  await assert.rejects(
    validatePublishedCaptionResources(publishedInput(url) as never, {
      fetchImpl: async () => new Response(validVtt.repeat(20), { headers: { "content-type": "text/vtt" } }),
      maxBytes: 64,
    }),
    /trop volumineux/i,
  );
});

test("local captions are read from a canonical file strictly below public", async () => {
  const root = await mkdtemp(join(tmpdir(), "irenee-vtt-"));
  temporaryDirectories.push(root);
  const publicRoot = join(root, "public");
  await mkdir(join(publicRoot, "media"), { recursive: true });
  await writeFile(join(publicRoot, "media", "valid.vtt"), validVtt);
  await writeFile(join(publicRoot, "media", "fake.vtt"), "not captions");
  await writeFile(join(root, "secret.vtt"), validVtt);
  await symlink(join(root, "secret.vtt"), join(publicRoot, "media", "escape.vtt"));

  await validatePublishedCaptionResources(publishedInput("/media/valid.vtt") as never, { publicRoot });
  await assert.rejects(
    validatePublishedCaptionResources(publishedInput("/media/fake.vtt") as never, { publicRoot }),
    /contenu WebVTT valide/i,
  );
  await assert.rejects(
    validatePublishedCaptionResources(publishedInput("/media/escape.vtt") as never, { publicRoot }),
    /chemin local.*invalide/i,
  );
  await assert.rejects(
    validatePublishedCaptionResources(publishedInput("/%2e%2e/secret.vtt") as never, { publicRoot }),
    /chemin local.*invalide/i,
  );
});

test("draft captions are not fetched before publication", async () => {
  let called = false;
  const input = publishedInput("https://res.cloudinary.com/da52mpv3g/raw/upload/course-fr.vtt");
  input.course.statut = "brouillon";
  await validatePublishedCaptionResources(input as never, {
    fetchImpl: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });
  assert.equal(called, false);
});

test("published validation deduplicates resources and bounds network concurrency", async () => {
  const urls = Array.from({ length: 8 }, (_, index) => `https://res.cloudinary.com/da52mpv3g/raw/upload/caption-${index}.vtt`);
  const input = publishedInput(urls[0]!);
  input.modules = [...urls, ...urls].map((url, index) => ({
    ...input.modules[0]!,
    titre: `Module ${index + 1}`,
    ordre: index + 1,
    url_sous_titres: url,
  }));
  let active = 0;
  let maximumActive = 0;
  const calls: string[] = [];

  await validatePublishedCaptionResources(input as never, {
    concurrency: 2,
    fetchImpl: async resource => {
      calls.push(String(resource));
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      return new Response(validVtt, { headers: { "content-type": "text/vtt" } });
    },
  });

  assert.equal(calls.length, urls.length);
  assert.equal(new Set(calls).size, urls.length);
  assert.equal(maximumActive, 2);
});
