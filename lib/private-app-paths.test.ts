import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateAppPath } from "./private-app-paths";

test("private working areas suppress public floating overlays", () => {
  for (const path of [
    "/admin",
    "/admin/courses",
    "/cours/introduction-apologetique-chretienne",
    "/cours/introduction-apologetique-chretienne/modules/module-id",
    "/devoirs",
    "/espace-etudiant",
    "/parametres"
  ]) {
    assert.equal(isPrivateAppPath(path), true, path);
  }
});

test("public pages keep the public floating overlays", () => {
  for (const path of ["/", "/formations", "/contact", "/blog/article"]) {
    assert.equal(isPrivateAppPath(path), false, path);
  }
});
