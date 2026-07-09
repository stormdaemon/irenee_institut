import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getModuleNavigation, getSafeCourseAssetUrl } from "../components/course-reader-utils";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("course asset URLs only keep web and root-relative destinations", () => {
  assert.equal(getSafeCourseAssetUrl(" /documents/support.pdf "), "/documents/support.pdf");
  assert.equal(getSafeCourseAssetUrl("https://cdn.example.org/video.mp4"), "https://cdn.example.org/video.mp4");
  assert.equal(getSafeCourseAssetUrl("http://localhost:3000/video.mp4"), "http://localhost:3000/video.mp4");
  assert.equal(getSafeCourseAssetUrl("http://cdn.example.org/video.mp4"), null);
  assert.equal(getSafeCourseAssetUrl("javascript:alert(1)"), null);
  assert.equal(getSafeCourseAssetUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(getSafeCourseAssetUrl("//evil.example/file.pdf"), null);
  assert.equal(getSafeCourseAssetUrl(""), null);
});

test("module navigation exposes a stable previous/next position", () => {
  const modules = [{ id: "one" }, { id: "two" }, { id: "three" }];

  assert.deepEqual(getModuleNavigation(modules, "one"), {
    currentIndex: 0,
    position: 1,
    total: 3,
    previousModule: null,
    nextModule: modules[1]
  });
  assert.deepEqual(getModuleNavigation(modules, "two"), {
    currentIndex: 1,
    position: 2,
    total: 3,
    previousModule: modules[0],
    nextModule: modules[2]
  });
  assert.deepEqual(getModuleNavigation(modules, "missing"), {
    currentIndex: -1,
    position: 0,
    total: 3,
    previousModule: null,
    nextModule: null
  });
});

test("course overview exposes semantic progress and objectives", () => {
  const page = source("app/cours/[slug]/page.tsx");

  assert.match(page, /role="progressbar"/);
  assert.match(page, /aria-valuenow=\{progress\}/);
  assert.match(page, /aria-valuemin=\{0\}/);
  assert.match(page, /aria-valuemax=\{100\}/);
  assert.match(page, /<ul className="course-objectives-list">/);
  assert.match(page, /<li key=\{item\}>/);
  assert.match(page, /\/auth\/login\?next=/);
  assert.match(page, /role="status" aria-live="polite" aria-busy="true"/);
});

test("module reader keeps save failures inline and always releases its busy state", () => {
  const page = source("app/cours/[slug]/modules/[moduleId]/page.tsx");
  const markComplete = page.match(/async function markComplete\(\) \{([\s\S]*?)\n  \}\n\n  if \(status === "loading"\)/)?.[1] || "";

  assert.match(page, /const \[saving, setSaving\] = useState\(false\)/);
  assert.match(page, /const \[saveError, setSaveError\] = useState\(""\)/);
  assert.match(markComplete, /try \{/);
  assert.match(markComplete, /finally \{\s*setSaving\(false\);\s*\}/);
  assert.match(markComplete, /setSaveError\(/);
  assert.doesNotMatch(markComplete, /setStatus\("error"\)/);
  assert.match(page, /className="course-save-error" role="alert"/);
  assert.match(page, /aria-busy=\{saving\}/);
});

test("module reader renders accessible video and adjacent text alternative", () => {
  const page = source("app/cours/[slug]/modules/[moduleId]/page.tsx");

  assert.match(page, /<video[\s\S]*controls[\s\S]*playsInline[\s\S]*preload="metadata"/);
  assert.match(page, /<summary>Résumé textuel de la vidéo<\/summary>/);
  assert.match(page, /Votre navigateur ne peut pas lire cette vidéo/);
  assert.match(page, /getSafeCourseAssetUrl\(module\.url_video/);
  assert.match(page, /className="module-video-unavailable" role="status"/);
});

test("module reader provides previous and next navigation with position", () => {
  const page = source("app/cours/[slug]/modules/[moduleId]/page.tsx");

  assert.match(page, /getModuleNavigation\(course\.modules, module\.id\)/);
  assert.match(page, /aria-label="Navigation entre les modules"/);
  assert.match(page, /Module \{navigation\.position\} sur \{navigation\.total\}/);
  assert.match(page, /navigation\.previousModule/);
  assert.match(page, /navigation\.nextModule/);
  assert.match(page, /\/auth\/login\?next=/);
});

test("reader styles scope guaranteed fallback contrast and readable measure", () => {
  const css = source("app/globals.css");
  const modulePage = source("app/cours/[slug]/modules/[moduleId]/page.tsx");

  assert.match(css, /\.module-text-content\s*\{[^}]*color:\s*#172033[^}]*background:\s*#fffaf0/);
  assert.match(css, /\.module-empty-content\s*\{[^}]*color:\s*#172033/);
  assert.match(modulePage, /\.module-content\s*\{[^}]*max-width:\s*72ch/);
  assert.match(css, /\.course-module-navigation\s*\{/);
  assert.match(css, /\.module-video-player\s*\{/);
});

test("private workspaces do not render donation and network distractions", () => {
  const chrome = source("components/DeferredClientChrome.tsx");

  assert.match(chrome, /function isPrivateWorkspacePath/);
  assert.match(chrome, /pathname\?\.startsWith\("\/cours"\)/);
  assert.match(chrome, /!privateWorkspace && <FloatingNetworkMenu \/>/);
  assert.match(chrome, /!privateWorkspace && <DonationPrompt \/>/);
  assert.match(chrome, /<OnboardingGate \/>/);
});
