import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdminCoursesPage, {
  courseStatusForSave,
  courseDraftSignature,
  draftAfterFailedCourseSave,
  serializeCourseModules,
  validateCourseDraft,
  type CourseDraft,
} from "../app/admin/courses/page";
import { RichHtmlEditor } from "../components/RichHtmlEditor";
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
        duree: 30,
        type_contenu: "texte",
        ordre: 1,
      }],
    }));
    assert.equal(ready.completed, ready.total);
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
});

describe("course editor accessibility contracts", () => {
  test("renders explicitly associated labels for the course fields", () => {
    const html = renderToStaticMarkup(createElement(AdminCoursesPage));

    assert.match(html, /for="course-title"/);
    assert.match(html, /id="course-title"/);
    assert.match(html, /for="course-description"/);
    assert.match(html, /id="course-description"/);
    assert.match(html, /aria-label="Étapes de création du cours"/);
    assert.match(html, /Aperçu/);
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
  assert.match(source, /publishRequested/);
  assert.doesNotMatch(source, /draft\.modules\.filter\(module => module\.titre\.trim\(\)\)/);
});
