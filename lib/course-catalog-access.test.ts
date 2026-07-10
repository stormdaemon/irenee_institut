import assert from "node:assert/strict";
import test from "node:test";
import { courseCatalogAccess } from "./course-catalog-access";

test("staff course cards open the reader without an annual pass", () => {
  assert.deepEqual(courseCatalogAccess("introduction-apologetique", true), {
    href: "/cours/introduction-apologetique",
    label: "Lire le cours",
  });
});

test("public course cards keep the annual-pass checkout", () => {
  assert.deepEqual(courseCatalogAccess("introduction-apologetique", false), {
    href: "/formations?checkout=annual-pass",
    label: "Accéder avec le pass annuel",
  });
});

test("staff reader links encode an unexpected slug as a single path segment", () => {
  assert.equal(courseCatalogAccess("cours/../secret", true).href, "/cours/cours%2F..%2Fsecret");
});
