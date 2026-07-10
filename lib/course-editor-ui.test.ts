import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdminCoursesPage, {
  courseStatusForSave,
  courseDraftSignature,
  duplicateCourseModuleDraft,
  draftAfterFailedCourseSave,
  serializeCourseModules,
  validateCourseDraft,
  type CourseDraft,
} from "../app/admin/courses/page";
import { RichHtmlEditor, richEditorTemplates } from "../components/RichHtmlEditor";
import { sanitizeCourseHtml } from "./course-input";
import { sanitizeCourseClassAttribute, sanitizeCourseStyleAttribute } from "./course-html-style";
import {
  courseDraftRecoveryKey,
  createCourseDraftRecovery,
  getCourseEditorReadiness,
  parseCourseDraftRecovery,
} from "./course-editor-workspace";

const draft = (overrides: Partial<CourseDraft> = {}): CourseDraft => ({
  titre: "Introduction",
  slug: "introduction",
  description: "Un cours de test",
  image_url: "",
  niveau: "debutant",
  statut: "brouillon",
  semestre: 1,
  numero: 1,
  prix: "99",
  prix_reduit: "49",
  duree_totale_minutes: 90,
  url_paiement_paypal: "",
  objectifs: ["Comprendre"],
  competences: ["Expliquer"],
  prerequis: ["Aucun"],
  modules: [],
  ...overrides,
});

describe("course editor draft safeguards", () => {
  test("never drops an untitled module while serializing", () => {
    const modules = serializeCourseModules([
      {
        clientId: "local-1",
        titre: "",
        description: "Une introduction déjà rédigée",
        contenu_html: "<p>Contenu important</p>",
        url_video: "",
        url_sous_titres: "",
        duree: 30,
        type_contenu: "texte",
        ordre: 1,
      },
    ]);

    assert.equal(modules.length, 1);
    assert.equal(modules[0]?.contenu_html, "<p>Contenu important</p>");
    assert.equal(Object.hasOwn(modules[0] || {}, "clientId"), false);
  });

  test("reports the exact module whose title is missing", () => {
    const issues = validateCourseDraft(draft({
      modules: [{
        clientId: "local-1",
        titre: " ",
        description: "",
        contenu_html: "<p>Texte</p>",
        url_video: "",
        url_sous_titres: "",
        duree: 15,
        type_contenu: "texte",
        ordre: 1,
      }],
    }));

    assert.ok(issues.some(issue => JSON.stringify(issue) === JSON.stringify({
      field: "module-title",
      message: "Donnez un titre au module 1.",
      moduleIndex: 0,
    })));
  });

  test("dirty signature ignores local UI identifiers but preserves authored content", () => {
    const first = draft({
      modules: [{
        clientId: "local-a",
        titre: "Module 1",
        description: "",
        contenu_html: "<p>Texte</p>",
        url_video: "",
        url_sous_titres: "",
        duree: 15,
        type_contenu: "texte",
        ordre: 1,
      }],
    });
    const sameContent = {
      ...first,
      modules: first.modules.map(module => ({ ...module, clientId: "local-b" })),
    };

    assert.equal(courseDraftSignature(first), courseDraftSignature(sameContent));
    assert.notEqual(courseDraftSignature({ ...sameContent, titre: "Titre changé" }), courseDraftSignature(first));
  });

  test("computes an actionable publication checklist instead of a vague completion score", () => {
    const incomplete = getCourseEditorReadiness(draft());
    assert.deepEqual(incomplete.items.map(item => [item.id, item.complete]), [
      ["identity", true],
      ["pedagogy", true],
      ["modules", false],
      ["content", false],
      ["publication", true],
    ]);
    assert.equal(incomplete.completed, 3);
    assert.equal(incomplete.total, 5);

    const ready = getCourseEditorReadiness(draft({
      modules: [{
        clientId: "local-1",
        titre: "Module 1",
        description: "Une introduction",
        contenu_html: "<p>Un contenu pédagogique.</p>",
        url_video: "",
        url_sous_titres: "",
        duree: 30,
        type_contenu: "texte",
        ordre: 1,
      }],
    }));
    assert.equal(ready.completed, ready.total);

    const videoWithoutCaptions = draft({
      statut: "publie",
      modules: [{
        clientId: "local-video",
        titre: "Module vidéo",
        description: "Une leçon filmée",
        contenu_html: "<p>Résumé textuel</p>",
        url_video: "/media/course.mp4",
        url_sous_titres: "",
        duree: 30,
        type_contenu: "video",
        ordre: 1,
      }],
    });
    assert.equal(getCourseEditorReadiness(videoWithoutCaptions).items.find(item => item.id === "content")?.complete, false);
    assert.deepEqual(validateCourseDraft(videoWithoutCaptions).find(issue => issue.field === "module-captions"), {
      field: "module-captions",
      message: "Ajoutez les sous-titres WebVTT du module 1 avant publication.",
      moduleIndex: 0,
    });
    videoWithoutCaptions.modules[0]!.url_sous_titres = "/media/course-fr.vtt";
    assert.equal(getCourseEditorReadiness(videoWithoutCaptions).items.find(item => item.id === "content")?.complete, true);

    videoWithoutCaptions.modules[0]!.url_sous_titres = `/media/${"é".repeat(2_045)}.vtt`;
    assert.equal(getCourseEditorReadiness(videoWithoutCaptions).items.find(item => item.id === "content")?.complete, false);
    assert.match(validateCourseDraft(videoWithoutCaptions).find(issue => issue.field === "module-captions")?.message || "", /4 096 octets/);
  });

  test("restores only a recent local draft based on the same server version", () => {
    const now = Date.UTC(2026, 6, 10, 12, 0, 0);
    const serverDraft = draft();
    const editedDraft = draft({ titre: "Introduction enrichie" });
    const recovery = createCourseDraftRecovery(editedDraft, serverDraft, now, {
      activeModuleClientId: "local-1",
      activeSection: "modules",
    });

    assert.deepEqual(parseCourseDraftRecovery(JSON.stringify(recovery), serverDraft, now + 1_000)?.draft, editedDraft);
    assert.deepEqual(parseCourseDraftRecovery(JSON.stringify(recovery), serverDraft, now + 1_000)?.workspace, {
      activeModuleClientId: "local-1",
      activeSection: "modules",
    });
    assert.equal(parseCourseDraftRecovery(JSON.stringify(recovery), draft({ description: "Version serveur plus récente" }), now + 1_000)?.serverConflict, true);
    assert.equal(parseCourseDraftRecovery(JSON.stringify(recovery), serverDraft, now + 8 * 24 * 60 * 60 * 1_000), null);
    assert.equal(parseCourseDraftRecovery("{not-json", serverDraft, now), null);
  });

  test("isolates local drafts by authenticated editor and browser tab", () => {
    assert.notEqual(
      courseDraftRecoveryKey("course-1", "user-a", "tab-1"),
      courseDraftRecoveryKey("course-1", "user-a", "tab-2"),
    );
    assert.notEqual(
      courseDraftRecoveryKey("course-1", "user-a", "tab-1"),
      courseDraftRecoveryKey("course-1", "user-b", "tab-1"),
    );
  });

  test("never turns a failed explicit publication into an implicit published save", () => {
    const workingDraft = draft({ statut: "en_preparation" });
    const submittedPublication = { ...workingDraft, statut: "publie" };

    assert.equal(courseStatusForSave("en_preparation", "brouillon", true), "publie");
    assert.equal(courseStatusForSave("publie", "brouillon", false), null);
    assert.equal(courseStatusForSave("publie", "publie", false), "publie");
    assert.equal(
      draftAfterFailedCourseSave(workingDraft, submittedPublication, true).statut,
      "en_preparation",
    );
  });

  test("duplicates a module as an independent unsaved copy", () => {
    const original = {
      clientId: "saved-module-1",
      id: "00000000-0000-4000-8000-000000000201",
      titre: "Module source",
      description: "Description source",
      contenu_html: "<p>Contenu source</p>",
      url_video: "",
      url_sous_titres: "",
      duree: 45,
      type_contenu: "quiz",
      ordre: 1,
      quiz: [{
        id: "question-source",
        question: "Question source ?",
        options: ["Réponse A", "Réponse B"],
        answer: 1,
      }],
    };

    const copy = duplicateCourseModuleDraft(original, "local-module-copy", 2);

    assert.equal(copy.id, undefined);
    assert.equal(Object.hasOwn(copy, "id"), false);
    assert.equal(copy.clientId, "local-module-copy");
    assert.equal(copy.ordre, 2);
    assert.equal(copy.titre, "Module source — copie");
    assert.notEqual(copy.quiz, original.quiz);
    assert.notEqual(copy.quiz?.[0], original.quiz[0]);
    assert.notEqual(copy.quiz?.[0]?.options, original.quiz[0]?.options);
    assert.notEqual(copy.quiz?.[0]?.id, original.quiz[0]?.id);
    assert.deepEqual(copy.quiz?.[0]?.options, original.quiz[0]?.options);

    const boundedCopy = duplicateCourseModuleDraft({ ...original, titre: "x".repeat(240) }, "unsafe copy/id", 2);
    assert.equal(boundedCopy.titre.length, 240);
    assert.match(boundedCopy.clientId, /^[a-zA-Z0-9_-]+$/);
  });
});

describe("course editor accessibility contracts", () => {
  test("keeps only reader-safe inline presentation shared with the API", () => {
    assert.equal(
      sanitizeCourseStyleAttribute("text-align:center; font-weight:700; color:#eee; background:#fff; font-size:9px; white-space:nowrap"),
      "text-align: center; font-weight: 700",
    );
    assert.equal(
      sanitizeCourseStyleAttribute("border-left: 4px solid #b7791f; padding: 1rem 2rem"),
      "border-left: 4px solid #b7791f; padding: 1rem 2rem",
    );
    assert.equal(sanitizeCourseStyleAttribute("border: url(javascript:alert(1)); text-align:center!important"), "");
    assert.equal(sanitizeCourseStyleAttribute("padding: 999999999rem; margin: -999999999px; border: 999999px solid red"), "");
    assert.equal(sanitizeCourseStyleAttribute("border: 9e8px solid red; border-left: 999999in solid blue; border-bottom: calc(1px + 999vh) solid black"), "");
    assert.equal(sanitizeCourseStyleAttribute("border: 2rem dashed rgba(12, 34, 56, .4)"), "border: 2rem dashed rgba(12, 34, 56, .4)");
    assert.equal(sanitizeCourseClassAttribute("course-callout course-callout-info main-header course-studio-mobile-save"), "course-callout course-callout-info");
  });

  test("renders explicitly associated labels for the course fields", () => {
    const html = renderToStaticMarkup(createElement(AdminCoursesPage));

    assert.match(html, /for="course-title"/);
    assert.match(html, /id="course-title"/);
    assert.match(html, /for="course-description"/);
    assert.match(html, /id="course-description"/);
    assert.match(html, /aria-label="Étapes de création du cours"/);
    assert.match(html, /Aperçu/);
    assert.match(html, /Studio des cours/);
    assert.match(html, /class="course-studio-workbench"/);
    assert.match(html, /class="course-studio-stage"/);
    assert.match(html, /class="course-overview-workspace"/);
    assert.match(html, /class="course-cover-preview"/);
  });

  test("exposes the rich editor as a named multiline textbox and its controls as a toolbar", () => {
    const html = renderToStaticMarkup(createElement(RichHtmlEditor, {
      id: "module-content-test",
      label: "Contenu du module 1",
      value: "<p>Bonjour</p>",
      onChange: () => undefined,
    }));

    assert.match(html, /role="toolbar"/);
    assert.match(html, /aria-label="Mise en forme de Contenu du module 1"/);
    assert.match(html, /role="textbox"/);
    assert.match(html, /aria-multiline="true"/);
    assert.match(html, /aria-label="Contenu du module 1"/);
    assert.match(html, /aria-label="Gras"/);
    assert.match(html, /class="rich-toolbar-group"/);
    assert.match(html, /aria-label="Structure du texte"/);
    assert.match(html, /aria-label="Mise en forme"/);
    assert.match(html, /aria-label="Listes et alignement"/);
    assert.match(html, /aria-label="Blocs pédagogiques"/);
  });

  test("makes wide tables and the mobile toolbar discoverable", () => {
    const html = renderToStaticMarkup(createElement(RichHtmlEditor, {
      id: "module-content-table",
      label: "Contenu avec tableau",
      value: "<table><tbody><tr><td>Cellule</td></tr></tbody></table>",
      onChange: () => undefined,
    }));

    assert.match(html, /Outils de mise en forme · faites glisser/);
    assert.match(html, /Tableau · faites glisser horizontalement/);
    assert.match(html, /aria-describedby="module-content-table-table-help"/);
  });

  test("uses semantic, style-free templates that survive the student reader", () => {
    assert.match(richEditorTemplates.info, /class="course-callout course-callout-info"/);
    assert.match(richEditorTemplates.warning, /class="course-callout course-callout-warning"/);
    assert.match(richEditorTemplates.quote, /class="course-quote"/);
    assert.match(richEditorTemplates.card, /class="course-block"/);
    for (const template of Object.values(richEditorTemplates)) {
      assert.doesNotMatch(template, /\sstyle=/i);
      assert.match(sanitizeCourseHtml(template), /class="course-(?:callout|quote|block)/);
    }
  });
});

test("save and navigation safeguards stay wired", async () => {
  const source = await readFile(new URL("../app/admin/courses/page.tsx", import.meta.url), "utf8");

  assert.match(source, /"beforeunload"/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /finally\s*\{\s*setSaving\(false\)/);
  assert.match(source, /localStorage/);
  assert.match(source, /Brouillon local/);
  assert.match(source, /Ajouter une question/);
  assert.match(source, /course-program-mobile-switch/);
  assert.match(source, /course-program-mobile-actions/);
  assert.match(source, /Actions rapides du module actif/);
  assert.match(source, /Module actif/);
  assert.match(source, /Dupliquer le module/);
  assert.match(source, /Sous-titres WebVTT \(\.vtt\)/);
  assert.match(source, /<track default kind="captions"/);
  assert.match(source, /module-captions/);
  assert.match(source, /publishRequested/);
  assert.doesNotMatch(source, /draft\.modules\.filter\(module => module\.titre\.trim\(\)\)/);
});
