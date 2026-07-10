import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getModuleNavigation, getSafeCourseAssetUrl, getSafeCourseMediaUrl } from "../components/course-reader-utils";
import { buildCourseJourney, parseReaderPreferences } from "./course-experience";

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

test("course media only permits local files and the institute Cloudinary account", () => {
  assert.equal(getSafeCourseMediaUrl("/videos/course.mp4"), "/videos/course.mp4");
  assert.equal(getSafeCourseMediaUrl("https://res.cloudinary.com/da52mpv3g/video/upload/video.mp4"), "https://res.cloudinary.com/da52mpv3g/video/upload/video.mp4");
  assert.equal(getSafeCourseMediaUrl("https://res.cloudinary.com/foreign/video/upload/video.mp4"), null);
  assert.equal(getSafeCourseMediaUrl("https://cdn.example.org/video.mp4"), null);
});

test("production course media never targets browser-local HTTP services", () => {
  const previousEnvironment = Object.getOwnPropertyDescriptor(process.env, "NODE_ENV");
  Object.defineProperty(process.env, "NODE_ENV", { configurable: true, enumerable: true, value: "production", writable: true });
  try {
    assert.equal(getSafeCourseMediaUrl("http://127.0.0.1:8080/admin"), null);
    assert.equal(getSafeCourseMediaUrl("http://localhost:3000/private"), null);
  } finally {
    if (previousEnvironment === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.defineProperty(process.env, "NODE_ENV", previousEnvironment);
  }
});

test("course assets reject legacy credential, backslash and encoded local-request bypasses", () => {
  assert.equal(getSafeCourseAssetUrl("https://user:pass@example.org/video.mp4"), null);
  assert.equal(getSafeCourseAssetUrl("https:\\evil.example/video.mp4"), null);
  assert.equal(getSafeCourseAssetUrl("/%5c%5cevil.example/video.mp4"), null);
  assert.equal(getSafeCourseAssetUrl("/%2f%2fevil.example/video.mp4"), null);
  assert.equal(getSafeCourseAssetUrl("//evil.example/video.mp4"), null);
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

test("course journey exposes exactly one current module and locks later work", () => {
  const modules = [
    { id: "one", titre: "Un" },
    { id: "two", titre: "Deux" },
    { id: "three", titre: "Trois" },
  ];
  const journey = buildCourseJourney(modules, [
    { module_id: "one", progression: 100, complete: true },
    { module_id: "two", progression: 35, complete: false },
  ]);

  assert.equal(journey.completedCount, 1);
  assert.equal(journey.overallProgress, 45);
  assert.equal(journey.resumeModule?.id, "two");
  assert.equal(journey.resumeLabel, "Reprendre le module 2");
  assert.deepEqual(journey.modules.map(item => item.state), ["complete", "current", "locked"]);
});

test("course journey never treats client progression as server completion", () => {
  const modules = [{ id: "one" }, { id: "two" }];
  const journey = buildCourseJourney(modules, [{ module_id: "one", progression: 100, complete: false }]);

  assert.equal(journey.completedCount, 0);
  assert.equal(journey.resumeModule?.id, "one");
  assert.deepEqual(journey.modules.map(item => item.state), ["current", "locked"]);
});

test("reader preferences are bounded and reject malformed persisted values", () => {
  assert.deepEqual(parseReaderPreferences('{"fontScale":"large","measure":"focused"}'), {
    fontScale: "large",
    measure: "focused",
  });
  assert.deepEqual(parseReaderPreferences('{"fontScale":"999","measure":"huge"}'), {
    fontScale: "normal",
    measure: "comfortable",
  });
  assert.deepEqual(parseReaderPreferences("not-json"), {
    fontScale: "normal",
    measure: "comfortable",
  });
});

test("course overview exposes semantic progress and objectives", () => {
  const page = source("app/cours/[slug]/page.tsx");

  assert.match(page, /role="progressbar"/);
  assert.match(page, /aria-valuenow=\{journey\.overallProgress\}/);
  assert.match(page, /aria-valuenow=\{item\.progress\}/);
  assert.match(page, /aria-valuemin=\{0\}/);
  assert.match(page, /aria-valuemax=\{100\}/);
  assert.match(page, /<ul className="course-objectives-list">/);
  assert.match(page, /<li key=\{item\}>/);
  assert.match(page, /\/auth\/login\?next=/);
  assert.match(page, /role="status" aria-live="polite" aria-busy="true"/);
  assert.match(page, /buildCourseJourney/);
  assert.match(page, /Reprendre/);
  assert.match(page, /Verrouillé/);
  assert.match(page, /"Intermédiaire"/);
  assert.match(page, /isAvailable \? <Eye/);
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
  assert.match(page, /getSafeCourseMediaUrl\(module\.url_video/);
  assert.match(page, /getSafeCourseMediaUrl\(module\.url_sous_titres/);
  assert.match(page, /<track[\s\S]*default[\s\S]*kind="captions"[\s\S]*srcLang="fr"[\s\S]*label="Français"/);
  assert.match(page, /className="module-video-caption-error" role="alert"/);
  assert.match(page, /className="module-video-unavailable" role="status"/);
  assert.match(page, /if \(captionsStatus === "error"\)/);
  assert.match(page, /videoRef\.current\?\.pause\(\)/);
  assert.match(page, /controls=\{captionsStatus === "ready"\}/);
  assert.match(page, /captionsStatus !== "error" && \(/);
});

test("module reader provides previous and next navigation with position", () => {
  const page = source("app/cours/[slug]/modules/[moduleId]/page.tsx");

  assert.match(page, /getModuleNavigation\(course\.modules, module\.id\)/);
  assert.match(page, /aria-label="Navigation entre les modules"/);
  assert.match(page, /Module \{navigation\.position\} sur \{navigation\.total\}/);
  assert.match(page, /navigation\.previousModule/);
  assert.match(page, /navigation\.nextModule/);
  assert.match(page, /\/auth\/login\?next=/);
  assert.match(page, /Plan du cours/);
  assert.match(page, /Réglages de lecture/);
  assert.match(page, /parseReaderPreferences/);
});

test("module reader prioritizes the lesson and preserves a long reading session", () => {
  const page = source("app/cours/[slug]/modules/[moduleId]/page.tsx");

  assert.match(page, /className="module-session-bar"/);
  assert.match(page, /aria-label="Progression de lecture"/);
  assert.match(page, /className="module-reading-anchor"/);
  assert.match(page, /irenee:reader-position:v1:/);
  assert.match(page, /<details className="reader-preferences">/);
  assert.match(page, /<summary>[\s\S]*Réglages de lecture/);
  assert.match(page, /className="module-preview-notice"/);
});

test("reader styles scope guaranteed fallback contrast and readable measure", () => {
  const css = source("app/globals.css");
  const modulePage = source("app/cours/[slug]/modules/[moduleId]/page.tsx");

  assert.match(css, /\.module-text-content\s*\{[^}]*color:\s*#172033[^}]*background:\s*#fffaf0/);
  assert.match(css, /\.module-empty-content\s*\{[^}]*color:\s*#172033/);
  assert.match(modulePage, /\.module-content\s*\{[^}]*max-width:\s*72ch/);
  assert.match(modulePage, /FORBID_TAGS:\s*\[[\s\S]*"style"/);
  assert.match(modulePage, /querySelectorAll<HTMLElement>\("\[style\]"\)/);
  assert.doesNotMatch(modulePage, /\$\{sanitizedCss\}/);
  assert.match(css, /\.course-module-navigation\s*\{/);
  assert.match(css, /\.module-video-player\s*\{/);
});

test("course editor quiz layout never overrides student answer alignment", () => {
  const css = source("app/globals.css");

  assert.match(css, /\.course-quiz-builder \.course-quiz-option\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*118px minmax\(0, 1fr\) 44px/);
  assert.doesNotMatch(css, /(?<!\.course-quiz-builder )\.course-quiz-option\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*118px/);
});

test("private workspaces do not render donation and network distractions", () => {
  const chrome = source("components/DeferredClientChrome.tsx");

  assert.match(chrome, /function isPrivateWorkspacePath/);
  assert.match(chrome, /pathname\?\.startsWith\("\/cours"\)/);
  assert.match(chrome, /!privateWorkspace && <FloatingNetworkMenu \/>/);
  assert.match(chrome, /!privateWorkspace && <DonationPrompt \/>/);
  assert.match(chrome, /<OnboardingGate \/>/);
});

test("course workspaces replace marketing chrome with focused navigation", () => {
  const header = source("components/Header.tsx");
  const radio = source("components/RadioPlayer.tsx");
  const footer = source("components/Footer.tsx");

  assert.match(header, /isCourseReader/);
  assert.match(header, /course-workspace-header/);
  assert.match(header, /Espace de cours/);
  assert.match(header, /Atelier des cours/);
  assert.match(radio, /if \(isCourseWorkspace\) return null/);
  assert.match(footer, /if \(isCourseWorkspace\) return null/);
});
