import test from "node:test";
import assert from "node:assert/strict";
import { toPublicCourse } from "./public-courses";
import type { Course } from "./types";

test("public course serialization never exposes paid module content", () => {
    const course = {
      id: "course-1",
      slug: "course-1",
      titre: "Cours",
      description: "Description publique",
      niveau: "debutant",
      duree_totale: 60,
      nb_modules: 1,
      prix: 9900,
      prix_reduit: 9900,
      objectifs: ["Objectif public"],
      modules: [{
        id: "module-1",
        titre: "Module",
        description: "Description",
        duree: 60,
        type: "texte",
        contenu_html: "<p>Contenu payant</p>",
        ressources: [{ url: "secret.pdf" }],
        quiz: [{ question: "Secret ?", options: ["Oui"], answer: 0 }]
      }]
    } satisfies Course;

  const publicCourse = toPublicCourse(course);
  const serialized = JSON.stringify(publicCourse);
  assert.equal("modules" in publicCourse, false);
  assert.equal(serialized.includes("Contenu payant"), false);
  assert.equal(serialized.includes("secret.pdf"), false);
  assert.equal(serialized.includes("Secret ?"), false);
});
