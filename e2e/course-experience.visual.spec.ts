import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";

const profile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "qa-director@irenee.test",
  prenom: "QA",
  nom: "Visuel",
  role: "directeur"
};

const course = {
  id: "00000000-0000-4000-8000-000000000101",
  titre: "Comprendre et transmettre la foi",
  slug: "cours-qa-visuel",
  description: "Un parcours de démonstration suffisamment long pour éprouver la lisibilité, la respiration et le retour à la ligne sur tous les écrans.",
  image_url: null,
  niveau: "intermediaire",
  statut: "publie",
  semestre: 1,
  numero: 1,
  prix: 9900,
  prix_reduit: 7900,
  duree_totale: 210,
  duree_totale_minutes: 210,
  nb_modules: 2,
  url_paiement_paypal: "",
  objectifs: [
    "Structurer une réponse claire et charitable.",
    "Identifier les sources fiables et les présenter sans jargon inutile."
  ],
  competences: ["Argumentation", "Lecture critique"],
  prerequis: ["Aucun prérequis technique"],
  modules: [
    {
      id: "00000000-0000-4000-8000-000000000201",
      course_id: "00000000-0000-4000-8000-000000000101",
      titre: "Poser les fondations",
      description: "Une introduction concrète avec texte structuré, encadré et tableau comparatif.",
      contenu: "",
      contenu_html: `
        <h2>Une lecture confortable, même sur mobile</h2>
        <p style="color:#eeeeee;background:#ffffff;font-size:9px;white-space:nowrap">Le lecteur doit neutraliser ce contraste volontairement défectueux et cette largeur hostile.</p>
        <p>Un cours utile permet de distinguer les faits, les interprétations et les objections. Le texte reste lisible sans zoom et sans défilement horizontal.</p>
        <div class="definition-box"><h3>Définition</h3><p>L'apologétique expose les raisons de croire avec précision et respect.</p></div>
        <table class="comparison-table">
          <thead><tr><th>Question examinée</th><th>Source principale</th><th>Point de vigilance</th></tr></thead>
          <tbody>
            <tr><td>Que dit le texte ?</td><td>Document original et contexte</td><td>Éviter l'extrait isolé</td></tr>
            <tr><td>Quelle conclusion ?</td><td>Raisonnement explicite</td><td>Distinguer preuve et hypothèse</td></tr>
          </tbody>
        </table>
        <h3>À mettre en pratique</h3>
        <ul><li>Reformuler l'objection loyalement.</li><li>Répondre avec une source vérifiable.</li></ul>
        <p>Mot très long pour le test de césure : antidisestablishmentarianismantidisestablishmentarianism.</p>
      `,
      url_video: "",
      duree: 90,
      type: "texte",
      type_contenu: "texte",
      ordre: 1,
      ressources: [
        { label: "Guide de lecture", url: "https://example.com/guide.pdf" },
        { label: "Lien dangereux filtré", url: "javascript:alert(1)" }
      ],
      quiz: []
    },
    {
      id: "00000000-0000-4000-8000-000000000202",
      course_id: "00000000-0000-4000-8000-000000000101",
      titre: "Construire une réponse",
      description: "Passer de la documentation à une réponse structurée.",
      contenu: "Une synthèse textuelle reste disponible si la vidéo ne peut pas être lue.",
      contenu_html: "<h2>Plan de réponse</h2><p>Thèse, raisons, sources, objection et conclusion.</p>",
      url_video: "",
      duree: 120,
      type: "video",
      type_contenu: "video",
      ordre: 2,
      ressources: [],
      quiz: [{ id: "q1", question: "Quelle étape vient en premier ?", options: ["Comprendre la question", "Conclure immédiatement"] }]
    }
  ]
};

const progress = [{
  course_id: course.id,
  module_id: course.modules[0].id,
  progression: 35,
  complete: false
}];

const viewports = [
  { name: "mobile-compact", width: 320, height: 568 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 }
] as const;

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json; charset=utf-8",
    headers: { "Cache-Control": "no-store" },
    status
  });
}

async function mockApplicationApis(page: Page) {
  await page.route("**/api/auth/user", route => fulfillJson(route, {
    session: { expires_at: 4_102_444_800, token_type: "cookie", user: profile },
    user: profile
  }));
  await page.route("**/api/auth/profile", route => fulfillJson(route, { profile }));
  await page.route("**/api/learning/courses/cours-qa-visuel", route => fulfillJson(route, {
    course,
    ok: true,
    profile,
    progress
  }));
  await page.route("**/api/progress/update", route => fulfillJson(route, { ok: true, verified: true }));
  await page.route("**/api/courses", async route => {
    if (route.request().method() === "GET") {
      await fulfillJson(route, [course]);
      return;
    }
    await fulfillJson(route, { data: course, ok: true, verified: true }, 201);
  });
  await page.route("**/api/courses/**", route => fulfillJson(route, {
    data: { ...course, titre: "Comprendre et transmettre la foi — révisé" },
    ok: true,
    verified: true
  }));
}

async function waitForStableUi(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(100);
}

async function assertNoHorizontalOverflow(page: Page) {
  const report = await page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const isClippedByScrollableAncestor = (element: HTMLElement) => {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body) {
        const overflowX = getComputedStyle(ancestor).overflowX;
        if (["auto", "clip", "hidden", "scroll"].includes(overflowX)) {
          const elementRect = element.getBoundingClientRect();
          const ancestorRect = ancestor.getBoundingClientRect();
          if (elementRect.right > ancestorRect.right + 1 || elementRect.left < ancestorRect.left - 1) return true;
        }
        ancestor = ancestor.parentElement;
      }
      return false;
    };
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter(element => {
        const style = getComputedStyle(element);
        if (style.position === "fixed" || style.position === "absolute" || style.display === "none") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && !isClippedByScrollableAncestor(element) && (rect.right > viewportWidth + 1 || rect.left < -1);
      })
      .slice(0, 12)
      .map(element => ({
        className: element.className?.toString().slice(0, 100) || "",
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
        tag: element.tagName
      }));
    return {
      clientWidth: viewportWidth,
      offenders,
      scrollWidth: root.scrollWidth
    };
  });

  expect(report, `Horizontal overflow: ${JSON.stringify(report)}`).toMatchObject({
    scrollWidth: report.clientWidth,
    offenders: []
  });

  for (const frame of page.frames().slice(1)) {
    const frameReport = await frame.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(frameReport.scrollWidth, "The isolated course-content frame must not overflow horizontally.").toBeLessThanOrEqual(frameReport.clientWidth + 1);
  }
}

async function assertAccessibleMain(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page })
    .include("#main-content")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const violations = results.violations.map(violation => ({
    help: violation.help,
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map(node => node.target.join(" ")).slice(0, 5)
  }));
  await testInfo.attach("axe-results", {
    body: JSON.stringify({ passes: results.passes.length, violations }, null, 2),
    contentType: "application/json"
  });
  expect(violations, `Axe found ${violations.length} WCAG violation(s): ${JSON.stringify(violations)}`).toEqual([]);
}

async function assertStableCourseFrame(page: Page) {
  const frame = page.locator("iframe[title^='Contenu du module']");
  const firstHeight = await frame.evaluate(element => element.getBoundingClientRect().height);
  await page.waitForTimeout(400);
  const secondHeight = await frame.evaluate(element => element.getBoundingClientRect().height);
  expect(secondHeight, "The course-content iframe height must settle instead of growing after ResizeObserver updates.").toBeCloseTo(firstHeight, 0);
  expect(secondHeight, "The sample module must remain within a credible rendered height.").toBeLessThan(5_000);
}

async function assertTouchTargets(page: Page) {
  const tooSmall = await page.locator("#main-content").evaluate(root => {
    const selector = "button, input:not([type='hidden']), select, textarea, [contenteditable='true'], a.btn, .icon-button, .toolbar-button";
    return Array.from(root.querySelectorAll<HTMLElement>(selector))
      .filter(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          height: Math.round(rect.height),
          label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 60) || element.tagName,
          width: Math.round(rect.width)
        };
      })
      .filter(target => target.height < 24 || target.width < 24);
  });
  expect(tooSmall, `Interactive targets below the WCAG 2.2 24px minimum: ${JSON.stringify(tooSmall)}`).toEqual([]);
}

for (const viewport of viewports) {
  test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ page }) => {
      await mockApplicationApis(page);
    });

    test("course overview is responsive, accessible and visually stable", async ({ page }, testInfo) => {
      await page.goto("/cours/cours-qa-visuel");
      await expect(page.getByRole("heading", { level: 1, name: course.titre })).toBeVisible();
      await waitForStableUi(page);
      await assertNoHorizontalOverflow(page);
      await assertAccessibleMain(page, testInfo);
      await assertTouchTargets(page);
      await expect(page).toHaveScreenshot(`course-overview-${viewport.name}.png`, { fullPage: true });
    });

    test("module reader contains hostile legacy content without layout or contrast regressions", async ({ page }, testInfo) => {
      await page.goto(`/cours/cours-qa-visuel/modules/${course.modules[0].id}`);
      await expect(page.getByRole("heading", { level: 1, name: course.modules[0].titre })).toBeVisible();
      const contentFrame = page.frameLocator("iframe[title^='Contenu du module']");
      await expect(contentFrame.getByRole("heading", { name: "Une lecture confortable, même sur mobile" })).toBeVisible();
      await waitForStableUi(page);
      await assertStableCourseFrame(page);
      await assertNoHorizontalOverflow(page);
      await assertAccessibleMain(page, testInfo);
      await assertTouchTargets(page);

      const normalizedLegacyText = await contentFrame.locator("p").first().evaluate(element => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          color: style.color,
          fontSize: style.fontSize,
          whiteSpace: style.whiteSpace
        };
      });
      expect(normalizedLegacyText).toMatchObject({
        color: "rgb(23, 32, 51)",
        fontSize: viewport.width <= 640 ? "17px" : "18px",
        whiteSpace: "normal"
      });
      await expect(page).toHaveScreenshot(`module-reader-${viewport.name}.png`, { fullPage: true });
    });

    test("course editor remains usable and visually stable", async ({ page }, testInfo) => {
      await page.goto(`/admin/courses?course=${course.slug}`);
      const title = page.getByLabel("Titre du cours *");
      await expect(title).toHaveValue(course.titre);
      await expect(page.getByRole("textbox", { name: "Contenu du module 1" })).toBeVisible();
      await waitForStableUi(page);
      await assertNoHorizontalOverflow(page);
      await assertAccessibleMain(page, testInfo);
      await assertTouchTargets(page);
      await expect(page).toHaveScreenshot(`course-editor-${viewport.name}.png`, { fullPage: true });
    });
  });
}

test("editor keyboard and save workflow work without touching persistent course data", async ({ page }) => {
  await mockApplicationApis(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/admin/courses?course=${course.slug}`);

  const title = page.getByLabel("Titre du cours *");
  await expect(title).toHaveValue(course.titre);
  await title.fill(`${course.titre} — révisé`);
  const save = page.getByRole("button", { name: "Enregistrer", exact: true });
  await expect(save).toBeEnabled();

  const editor = page.getByRole("textbox", { name: "Contenu du module 1" });
  await editor.focus();
  await expect(editor).toBeFocused();
  await page.getByRole("button", { name: "Modifier le code HTML" }).click();
  await expect(page.getByRole("textbox", { name: "Contenu du module 1 — code HTML" })).toBeVisible();
  await page.getByRole("button", { name: "Revenir à l'éditeur visuel" }).click();

  await save.click();
  await expect(page.getByText("Cours enregistré.")).toBeVisible();
  await expect(save).toBeDisabled();
});
