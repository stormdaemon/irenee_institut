import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stylesheet = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const adminUsersPage = readFileSync(new URL("../app/admin/users/page.tsx", import.meta.url), "utf8");
const coursePage = readFileSync(new URL("../app/cours/[slug]/page.tsx", import.meta.url), "utf8");
const modulePage = readFileSync(new URL("../app/cours/[slug]/modules/[moduleId]/page.tsx", import.meta.url), "utf8");
const formationsPage = readFileSync(new URL("../app/formations/page.tsx", import.meta.url), "utf8");
const homePage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

function rule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] || "";
}

test("course assignment modal stays inside the viewport above the header", () => {
  assert.match(adminUsersPage, /className="course-assignment-backdrop"/);
  assert.match(adminUsersPage, /className="card course-assignment-modal"/);
  assert.match(adminUsersPage, /className="course-assignment-option"/);
  assert.match(adminUsersPage, /className="course-assignment-footer"/);
  assert.match(adminUsersPage, /        <\/div>\n      <\/div>\n      \{selected && \(/);

  assert.match(rule(".course-assignment-backdrop"), /z-index:\s*500\s*;/);
  assert.match(rule(".course-assignment-modal"), /max-height:\s*calc\(100dvh\s*-\s*40px\)\s*;/);
  assert.match(rule(".course-assignment-modal"), /overflow-y:\s*auto\s*;/);
  assert.match(rule(".course-assignment-option"), /background:\s*rgba\(220,\s*180,\s*107,\s*\.08\)\s*;/);
});

test("course pages use dark-theme contrast helpers", () => {
  assert.match(coursePage, /className="section course-page"/);
  assert.match(coursePage, /className="font-display course-section-title"/);
  assert.match(modulePage, /className="course-module-content"/);

  assert.match(rule(".course-section-title"), /color:\s*#fff7e7\s*!important\s*;/);
  assert.match(rule(".course-module-content"), /color:\s*#eadabd\s*;/);
  assert.match(rule(".course-module-content"), /overflow-x:\s*auto\s*;/);
  assert.match(rule(".course-module-content .module-content"), /color:\s*#eadabd\s*!important\s*;/);
  assert.match(rule(".course-module-content .definition-box"), /color:\s*#1f2937\s*!important\s*;/);
  assert.match(rule(".course-module-content .comparison-table td"), /background:\s*#f9fafb\s*!important\s*;/);
});

test("public course grids stay outside the floating shortcut rails", () => {
  assert.match(formationsPage, /className="container grid-2 course-catalog-grid"/);
  assert.match(homePage, /className="grid-2 course-catalog-grid"/);
  assert.match(rule(".course-catalog-grid"), /width:\s*min\(1100px,\s*calc\(100vw\s*-\s*440px\)\)\s*;/);
});
