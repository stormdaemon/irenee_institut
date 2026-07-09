import assert from "node:assert/strict";
import test from "node:test";
import {
  CourseInputError,
  parseCourseForm,
  sanitizeCourseHtml,
  sanitizeExternalUrl
} from "./course-input";

function validForm() {
  const form = new FormData();
  form.set("titre", "Introduction à l'apologétique");
  form.set("slug", "introduction-apologetique");
  form.set("description", "Un cours structuré et accessible.");
  form.set("niveau", "debutant");
  form.set("statut", "brouillon");
  form.set("semestre", "1");
  form.set("numero", "1");
  form.set("prix", "99");
  form.set("prix_reduit", "79");
  form.set("duree_totale_minutes", "120");
  form.set("objectifs", JSON.stringify(["Comprendre", "Expliquer"]));
  form.set("competences", JSON.stringify(["Argumenter"]));
  form.set("prerequis", JSON.stringify([]));
  form.set("modules", JSON.stringify([
    {
      titre: "Première leçon",
      description: "Découvrir les bases.",
      contenu_html: "<h2>Bienvenue</h2><p>Un <strong>contenu</strong> sûr.</p>",
      duree: 30,
      ordre: 1,
      type_contenu: "texte",
      url_video: ""
    }
  ]));
  return form;
}

test("sanitizeCourseHtml removes executable markup while preserving pedagogical formatting", () => {
  const clean = sanitizeCourseHtml(`
    <style>@import url(https://evil.test/x.css); p { color: red }</style>
    <h2 onclick="steal()">Titre</h2>
    <script>alert(1)</script>
    <img src=x onerror="steal()">
    <a href="javascript:steal()" target="_blank">piège</a>
    <blockquote><strong>Texte sûr</strong></blockquote>
  `);

  assert.doesNotMatch(clean, /script|onerror|onclick|javascript:|@import/i);
  assert.match(clean, /<h2>Titre<\/h2>/);
  assert.match(clean, /<blockquote><strong>Texte sûr<\/strong><\/blockquote>/);
});

test("sanitizeExternalUrl only accepts explicit HTTPS and safe local paths", () => {
  assert.equal(sanitizeExternalUrl("https://cdn.example.test/video.mp4"), "https://cdn.example.test/video.mp4");
  assert.equal(sanitizeExternalUrl("/images/course.webp"), "/images/course.webp");
  assert.equal(sanitizeExternalUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeExternalUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(sanitizeExternalUrl("//evil.test/file"), "");
  assert.equal(sanitizeExternalUrl("http://evil.test/file"), "");
});

test("parseCourseForm validates, normalizes and sanitizes the complete payload", () => {
  const parsed = parseCourseForm(validForm());

  assert.equal(parsed.course.slug, "introduction-apologetique");
  assert.equal(parsed.course.prix, 9900);
  assert.equal(parsed.course.nb_modules, 1);
  assert.equal(parsed.modules[0].titre, "Première leçon");
  assert.match(parsed.modules[0].contenu_html, /<strong>contenu<\/strong>/);
});

test("parseCourseForm fails closed on malformed JSON instead of deleting modules", () => {
  const form = validForm();
  form.set("modules", "{broken");
  assert.throws(() => parseCourseForm(form), CourseInputError);
});

test("parseCourseForm rejects unnamed modules, unsupported states and oversized HTML", () => {
  const unnamed = validForm();
  unnamed.set("modules", JSON.stringify([{ titre: "", contenu_html: "<p>x</p>" }]));
  assert.throws(() => parseCourseForm(unnamed), /titre/i);

  const invalidState = validForm();
  invalidState.set("statut", "root");
  assert.throws(() => parseCourseForm(invalidState), /statut/i);

  const oversized = validForm();
  oversized.set("modules", JSON.stringify([{ titre: "Leçon", contenu_html: "x".repeat(1_000_001) }]));
  assert.throws(() => parseCourseForm(oversized), /volumineux/i);
});

test("parseCourseForm rejects module identifiers that are not UUIDs", () => {
  const form = validForm();
  form.set("modules", JSON.stringify([{ id: "1 OR 1=1", titre: "Leçon", contenu_html: "<p>x</p>" }]));
  assert.throws(() => parseCourseForm(form), /identifiant/i);
});
