import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type Route, type TestInfo } from "@playwright/test";

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

type MockCourse = typeof course;
type MockModule = MockCourse["modules"][number];

type MockApplicationOptions = {
  course?: MockCourse;
  module?: MockModule;
  progress?: typeof progress;
  courseWrite?: { body: unknown; status: number };
  progressWrite?: { body: unknown; status: number };
};

const viewports = [
  { name: "mobile-compact", width: 320, height: 568 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 }
] as const;

const runtimeErrors = new WeakMap<Page, string[]>();
const hostileLegacyStyleBlock = "<div><style>body{display:none!important;background-image:url(https://tracking.example.test/pixel)!important}</style></div>";

function monitorRuntimeErrors(page: Page) {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    const text = message.text();
    // Playwright's frame.evaluate probes intentionally execute inside our
    // no-scripts sandbox and Chromium reports the expected denial as an error.
    if (text.includes("about:srcdoc") && text.includes("'allow-scripts' permission is not set")) return;
    if (message.type() === "error") errors.push(`console.error: ${text}`);
  });
}

function assertNoRuntimeErrors(page: Page) {
  expect(runtimeErrors.get(page) || [], "The focused course workspace must not emit browser errors.").toEqual([]);
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json; charset=utf-8",
    headers: { "Cache-Control": "no-store" },
    status
  });
}

async function mockApplicationApis(page: Page, options: MockApplicationOptions = {}) {
  const mockedCourse = options.course || course;
  const mockedModule = options.module || mockedCourse.modules[0];
  const mockedProgress = options.progress || progress;

  await page.route("**/api/auth/user", route => fulfillJson(route, {
    session: { expires_at: 4_102_444_800, token_type: "cookie", user: profile },
    user: profile
  }));
  await page.route("**/api/auth/profile", route => fulfillJson(route, { profile }));
  await page.route("**/api/learning/courses/cours-qa-visuel/modules/**", route => fulfillJson(route, {
    course: {
      ...mockedCourse,
      modules: mockedCourse.modules.map(({ contenu, contenu_html, quiz, ressources, url_video, ...module }) => module)
    },
    module: {
      ...mockedModule,
      contenu_html: `${hostileLegacyStyleBlock}${mockedModule.contenu_html || mockedModule.contenu || ""}`
    },
    ok: true,
    profile,
    progress: mockedProgress
  }));
  await page.route("**/api/learning/courses/cours-qa-visuel", route => fulfillJson(route, {
    course: mockedCourse,
    ok: true,
    profile,
    progress: mockedProgress
  }));
  await page.route("**/api/progress/update", route => {
    if (options.progressWrite) return fulfillJson(route, options.progressWrite.body, options.progressWrite.status);
    return fulfillJson(route, {
      data: {
        complete: false,
        course_id: mockedCourse.id,
        date_debut: "2026-01-01T00:00:00.000Z",
        module_id: mockedModule.id,
        progression: 35,
        statut: "en_cours"
      },
      ok: true,
      verified: true
    });
  });
  await page.route("**/api/courses", async route => {
    if (route.request().method() === "GET") {
      await fulfillJson(route, [mockedCourse]);
      return;
    }
    if (options.courseWrite) {
      await fulfillJson(route, options.courseWrite.body, options.courseWrite.status);
      return;
    }
    await fulfillJson(route, { data: mockedCourse, ok: true, verified: true }, 201);
  });
  await page.route("**/api/courses/**", route => {
    if (options.courseWrite) return fulfillJson(route, options.courseWrite.body, options.courseWrite.status);
    return fulfillJson(route, {
      data: { ...mockedCourse, titre: "Comprendre et transmettre la foi — révisé" },
      ok: true,
      verified: true
    });
  });
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
    const isContainedByReachableHorizontalScroller = (element: HTMLElement) => {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body) {
        const overflowX = getComputedStyle(ancestor).overflowX;
        if (["auto", "scroll"].includes(overflowX) && ancestor.scrollWidth > ancestor.clientWidth + 1) {
          const elementRect = element.getBoundingClientRect();
          const ancestorRect = ancestor.getBoundingClientRect();
          if (elementRect.right > ancestorRect.right + 1 || elementRect.left < ancestorRect.left - 1) return true;
        }
        // `clip` and `hidden` make excess content unreachable. They must never
        // turn a genuine overflow into a passing result.
        ancestor = ancestor.parentElement;
      }
      return false;
    };
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter(element => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && !isContainedByReachableHorizontalScroller(element) && (rect.right > viewportWidth + 1 || rect.left < -1);
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
    // The srcdoc reader intentionally forbids scripts. Audit its host semantics
    // separately instead of weakening the sandbox so Axe can inject itself.
    .exclude("iframe[title^='Contenu du module']")
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
  const tooSmall = await page.locator("body").evaluate(root => {
    const selector = "button, a[href], summary, input:not([type='hidden']), select, textarea, [contenteditable='true']";
    return Array.from(root.querySelectorAll<HTMLElement>(selector))
      .filter(element => {
        const target = element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
          ? element.labels?.[0] || element
          : element;
        const rect = target.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0
          && rect.bottom > 0 && rect.right > 0;
      })
      .map(element => {
        const target = element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
          ? element.labels?.[0] || element
          : element;
        const rect = target.getBoundingClientRect();
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

async function assertComfortableMobileTargets(page: Page) {
  const tooSmall = await page.locator("body").evaluate(root => Array.from(root.querySelectorAll<HTMLElement>("button, a[href], summary, select, input:not([type='hidden']), textarea, [contenteditable='true']"))
    .filter(element => {
      const target = element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
        ? element.labels?.[0] || element
        : element;
      const rect = target.getBoundingClientRect();
      const style = getComputedStyle(element);
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0
        && rect.bottom > 0 && rect.right > 0;
    })
    .map(element => {
      const target = element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
        ? element.labels?.[0] || element
        : element;
      const rect = target.getBoundingClientRect();
      return {
        height: Math.round(rect.height),
        label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 60) || element.tagName,
        width: Math.round(rect.width)
      };
    })
    .filter(target => target.height < 44 || target.width < 44));
  expect(tooSmall, `Primary mobile targets below 44px: ${JSON.stringify(tooSmall)}`).toEqual([]);
}

async function assertTargetIsNotCovered(target: Locator, overlay: Locator) {
  const [targetBox, overlayBox] = await Promise.all([target.boundingBox(), overlay.boundingBox()]);
  expect(targetBox, "The focused control must have a measurable box.").not.toBeNull();
  expect(overlayBox, "The mobile save bar must have a measurable box.").not.toBeNull();
  if (!targetBox || !overlayBox) return;

  const targetBottom = targetBox.y + targetBox.height;
  const overlayBottom = overlayBox.y + overlayBox.height;
  const separated = targetBottom <= overlayBox.y - 8 || targetBox.y >= overlayBottom + 8;
  expect(separated, `Focused control ${JSON.stringify(targetBox)} is covered by ${JSON.stringify(overlayBox)}.`).toBe(true);
}

async function assertHorizontallyScrollableTable(page: Page) {
  const scroller = page.locator(".course-program-editor .rich-canvas").first();
  const table = page.locator(".course-program-editor .rich-canvas table").first();
  await expect(scroller).toBeVisible();
  await expect(table).toBeVisible();
  const before = await scroller.evaluate(element => ({
    clientWidth: element.clientWidth,
    overflowX: getComputedStyle(element).overflowX,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth
  }));
  expect(before.scrollWidth, "The stress-test table should overflow at a mobile width.").toBeGreaterThan(before.clientWidth + 1);
  expect(["auto", "scroll"], "The overflowing table must expose a reachable horizontal scroller.").toContain(before.overflowX);

  await scroller.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  const after = await scroller.evaluate(element => ({ scrollLeft: element.scrollLeft, maximum: element.scrollWidth - element.clientWidth }));
  expect(after.scrollLeft, "The table must move when scrolled to its last column.").toBeGreaterThan(0);
  expect(after.scrollLeft).toBeCloseTo(after.maximum, 0);

  const lastCell = table.locator("tr").last().locator("th, td").last();
  const [scrollerBox, cellBox] = await Promise.all([scroller.boundingBox(), lastCell.boundingBox()]);
  expect(scrollerBox).not.toBeNull();
  expect(cellBox).not.toBeNull();
  if (scrollerBox && cellBox) {
    expect(cellBox.x + cellBox.width).toBeLessThanOrEqual(scrollerBox.x + scrollerBox.width + 1);
    expect(cellBox.x).toBeGreaterThanOrEqual(scrollerBox.x - 1);
  }
}

async function openProgrammeByTouch(page: Page) {
  const programme = page.getByRole("button", { name: /Programme/ });
  await programme.scrollIntoViewIfNeeded();
  await expect(programme).toBeVisible();
  await programme.tap();
  await expect(programme).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("heading", { level: 3, name: "Programme du cours" })).toBeVisible();
}

for (const viewport of viewports) {
  test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({
      hasTouch: viewport.width <= 390,
      isMobile: viewport.width <= 390,
      viewport: { width: viewport.width, height: viewport.height }
    });

    test.beforeEach(async ({ page }) => {
      monitorRuntimeErrors(page);
      await mockApplicationApis(page);
    });

    test("course overview is responsive, accessible and visually stable", async ({ page }, testInfo) => {
      await page.goto("/cours/cours-qa-visuel");
      await expect(page.getByRole("heading", { level: 1, name: course.titre })).toBeVisible();
      await waitForStableUi(page);
      await assertNoHorizontalOverflow(page);
      await assertAccessibleMain(page, testInfo);
      await assertTouchTargets(page);
      if (viewport.width <= 390) await assertComfortableMobileTargets(page);
      if (viewport.width <= 390) await expect(page).toHaveScreenshot(`course-overview-${viewport.name}-first-fold.png`);
      await expect(page).toHaveScreenshot(`course-overview-${viewport.name}.png`, { fullPage: true });
      assertNoRuntimeErrors(page);
    });

    test("module reader contains hostile legacy content without layout or contrast regressions", async ({ page }, testInfo) => {
      await page.goto(`/cours/cours-qa-visuel/modules/${course.modules[0].id}`);
      await expect(page.getByRole("heading", { level: 1, name: course.modules[0].titre })).toBeVisible();
      const contentFrame = page.frameLocator("iframe[title^='Contenu du module']");
      await expect(contentFrame.getByRole("heading", { name: "Une lecture confortable, même sur mobile" })).toBeVisible();
      await expect(contentFrame.locator("main.module-content style")).toHaveCount(0);
      await waitForStableUi(page);
      await assertStableCourseFrame(page);
      await assertNoHorizontalOverflow(page);
      await assertAccessibleMain(page, testInfo);
      await assertTouchTargets(page);
      if (viewport.width <= 390) await assertComfortableMobileTargets(page);

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
      if (viewport.width <= 390) await expect(page).toHaveScreenshot(`module-reader-${viewport.name}-first-fold.png`);
      await expect(page).toHaveScreenshot(`module-reader-${viewport.name}.png`, { fullPage: true });
      assertNoRuntimeErrors(page);
    });

    test("course editor overview remains focused and visually stable", async ({ page }, testInfo) => {
      await page.goto(`/admin/courses?course=${course.slug}`);
      const title = page.getByLabel("Titre du cours *");
      await expect(title).toHaveValue(course.titre);
      await waitForStableUi(page);
      await assertNoHorizontalOverflow(page);
      await assertAccessibleMain(page, testInfo);
      await assertTouchTargets(page);
      if (viewport.width <= 390) await assertComfortableMobileTargets(page);
      await expect(page).toHaveScreenshot(`course-editor-overview-${viewport.name}.png`, { fullPage: true });
      assertNoRuntimeErrors(page);
    });

    test("course programme edits one module at a time and remains visually stable", async ({ page }, testInfo) => {
      await page.goto(`/admin/courses?course=${course.slug}`);
      await expect(page.getByLabel("Titre du cours *")).toHaveValue(course.titre);
      await page.getByRole("button", { name: /Programme/ }).click();
      await expect(page.getByRole("textbox", { name: "Contenu du module 1" })).toBeVisible();
      await waitForStableUi(page);
      await assertNoHorizontalOverflow(page);
      await assertAccessibleMain(page, testInfo);
      await assertTouchTargets(page);
      if (viewport.width <= 390) await assertComfortableMobileTargets(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      if (viewport.width <= 390) await expect(page).toHaveScreenshot(`course-editor-programme-${viewport.name}-first-fold.png`);
      await expect(page).toHaveScreenshot(`course-editor-programme-${viewport.name}.png`, { fullPage: true });
      assertNoRuntimeErrors(page);
    });
  });
}

test.describe("critical mobile workspace states", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("dirty editor command bar stays reachable without covering the focused field", async ({ page }) => {
    monitorRuntimeErrors(page);
    await mockApplicationApis(page);
    await page.goto(`/admin/courses?course=${course.slug}`);
    await page.getByLabel("Titre du cours *").fill(`${course.titre} — mobile`);
    await openProgrammeByTouch(page);

    const editor = page.getByRole("textbox", { name: "Contenu du module 1" });
    const focusedField = page.getByLabel("Durée (min)");
    const mobileSave = page.locator(".course-studio-mobile-save");
    await expect(editor).toBeVisible();
    await expect(mobileSave).toBeVisible();
    await page.setViewportSize({ width: 390, height: 520 });
    await focusedField.focus();
    await focusedField.scrollIntoViewIfNeeded();
    await assertTargetIsNotCovered(focusedField, mobileSave);
    await assertNoHorizontalOverflow(page);
    await assertComfortableMobileTargets(page);
    await expect(page).toHaveScreenshot("course-editor-dirty-mobile-keyboard.png");
    assertNoRuntimeErrors(page);
  });

  test("server save error retains edits and exposes a recoverable state", async ({ page }) => {
    monitorRuntimeErrors(page);
    await mockApplicationApis(page, {
      courseWrite: { body: { error: "Échec de sauvegarde simulé pour le QA." }, status: 500 }
    });
    await page.goto(`/admin/courses?course=${course.slug}`);
    const title = page.getByLabel("Titre du cours *");
    const changedTitle = `${course.titre} — à conserver`;
    await title.fill(changedTitle);
    page.once("dialog", dialog => dialog.accept());
    await page.locator(".course-studio-mobile-save .btn").tap();

    await expect(page.locator(".action-notice[role='alert']")).toContainText("Échec de sauvegarde simulé pour le QA.");
    await expect(title).toHaveValue(changedTitle);
    await expect(page.locator(".course-studio-mobile-save")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot("course-editor-save-error-mobile.png");
    const errors = runtimeErrors.get(page) || [];
    const expectedHttpFailure = (message: string) => message.includes("Failed to load resource") && message.includes("500");
    expect(errors.some(expectedHttpFailure), "The simulated HTTP 500 must remain observable in the browser console.").toBe(true);
    expect(errors.filter(message => !expectedHttpFailure(message)), "No unrelated runtime error may accompany the simulated save failure.").toEqual([]);
  });

  test("validation error is announced, focused and visually unambiguous", async ({ page }) => {
    monitorRuntimeErrors(page);
    await mockApplicationApis(page);
    await page.goto(`/admin/courses?course=${course.slug}`);
    const courseSwitch = page.getByLabel("Cours actif");
    const newCourseButton = page.getByRole("button", { name: "Nouveau cours" });
    await expect(courseSwitch).toHaveValue(course.id);
    await expect(newCourseButton).toBeEnabled();
    await newCourseButton.tap();
    await expect(courseSwitch).toHaveValue("");
    await expect(page.getByText("Création", { exact: true })).toBeVisible();
    await page.getByLabel("Titre du cours *").fill("Cours QA incomplet");
    await page.keyboard.press("ControlOrMeta+S");

    const description = page.getByLabel("Description courte *");
    await expect(page.locator(".action-notice[role='alert']")).toContainText("Ajoutez une description courte au cours.");
    await expect(description).toHaveAttribute("aria-invalid", "true");
    await expect(description).toBeFocused();
    await expect(page).toHaveScreenshot("course-editor-validation-mobile.png");
    assertNoRuntimeErrors(page);
  });

  test("local draft recovery is explicit before replacing server content", async ({ page }) => {
    monitorRuntimeErrors(page);
    await mockApplicationApis(page);
    await page.goto(`/admin/courses?course=${course.slug}`);
    await page.getByLabel("Titre du cours *").fill(`${course.titre} — récupération QA`);
    await expect(page.getByText("Brouillon local enregistré sur cet appareil.")).toBeVisible({ timeout: 3_000 });
    await page.reload();

    const recovery = page.getByRole("heading", { name: "Brouillon local disponible" });
    await expect(recovery).toBeVisible();
    await expect(page.getByRole("button", { name: "Restaurer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refuser" })).toBeVisible();
    await expect(page).toHaveScreenshot("course-editor-recovery-mobile.png");
    assertNoRuntimeErrors(page);
  });

  test("mobile course plan opens by touch and keeps locked modules non-actionable", async ({ page }, testInfo) => {
    monitorRuntimeErrors(page);
    await mockApplicationApis(page);
    await page.goto(`/cours/${course.slug}/modules/${course.modules[0].id}`);
    const plan = page.locator(".module-mobile-plan");
    await plan.locator("summary").tap();

    await expect(plan).toHaveAttribute("open", "");
    await expect(plan.getByText(course.modules[0].titre)).toBeVisible();
    const lockedModule = plan.locator("li").filter({ hasText: course.modules[1].titre });
    await expect(lockedModule.getByRole("link")).toHaveCount(0);
    await assertAccessibleMain(page, testInfo);
    await assertComfortableMobileTargets(page);
    await expect(page).toHaveScreenshot("module-reader-plan-open-mobile.png");
    assertNoRuntimeErrors(page);
  });

  test("quiz state is accessible and visually stable on touch", async ({ page }, testInfo) => {
    const quizModule = {
      ...course.modules[0],
      contenu: "Relisez le module avant de répondre.",
      contenu_html: "<h2>Vérifiez votre compréhension</h2><p>Choisissez la réponse la plus juste.</p>",
      quiz: [{ id: "q1", question: "Quelle étape vient en premier ?", options: ["Comprendre la question", "Conclure immédiatement"] }],
      type: "quiz",
      type_contenu: "quiz"
    } as MockModule;
    const quizCourse = { ...course, modules: [quizModule, course.modules[1]] } as MockCourse;
    monitorRuntimeErrors(page);
    await mockApplicationApis(page, { course: quizCourse, module: quizModule });
    await page.goto(`/cours/${course.slug}/modules/${quizModule.id}`);
    await page.getByLabel("Comprendre la question").check();

    const quiz = page.locator(".course-quiz-card");
    await expect(quiz).toBeVisible();
    await assertAccessibleMain(page, testInfo);
    await assertComfortableMobileTargets(page);
    await expect(quiz).toHaveScreenshot("module-reader-quiz-card-mobile.png");
    assertNoRuntimeErrors(page);
  });

  test("unavailable video preserves the textual lesson and a clear fallback", async ({ page }, testInfo) => {
    const videoModule = {
      ...course.modules[0],
      contenu: "Le résumé textuel reste disponible lorsque la vidéo ne peut pas être chargée.",
      type: "video",
      type_contenu: "video",
      url_video: ""
    } as MockModule;
    const videoCourse = { ...course, modules: [videoModule, course.modules[1]] } as MockCourse;
    monitorRuntimeErrors(page);
    await mockApplicationApis(page, { course: videoCourse, module: videoModule });
    await page.goto(`/cours/${course.slug}/modules/${videoModule.id}`);

    const fallback = page.locator(".module-video-unavailable");
    await expect(page.getByRole("heading", { name: "Vidéo temporairement indisponible" })).toBeVisible();
    await expect(page.frameLocator("iframe[title^='Contenu du module']").getByText("Une lecture confortable")).toBeVisible();
    await assertAccessibleMain(page, testInfo);
    await expect(fallback).toHaveScreenshot("module-reader-video-fallback-mobile.png");
    assertNoRuntimeErrors(page);
  });

  test("wide editor table can be panned to its final column", async ({ page }) => {
    monitorRuntimeErrors(page);
    await mockApplicationApis(page);
    await page.goto(`/admin/courses?course=${course.slug}`);
    await openProgrammeByTouch(page);
    await assertHorizontallyScrollableTable(page);
    const scroller = page.locator(".course-program-editor .rich-canvas").first();
    await expect(scroller).toHaveScreenshot("course-editor-table-last-column-mobile.png");
    assertNoRuntimeErrors(page);
  });

  test("admin quiz builder supports a complete question by touch", async ({ page }, testInfo) => {
    monitorRuntimeErrors(page);
    await mockApplicationApis(page);
    await page.goto(`/admin/courses?course=${course.slug}`);
    await openProgrammeByTouch(page);
    await page.getByLabel("Type de contenu").selectOption("quiz");
    await page.getByRole("button", { name: "Ajouter la première question" }).tap();

    await page.getByLabel("Intitulé de la question").fill("Quelle démarche faut-il privilégier ?");
    await page.getByRole("textbox", { name: "Réponse 1", exact: true }).fill("Comprendre avant de répondre");
    await page.getByRole("textbox", { name: "Réponse 2", exact: true }).fill("Répondre sans vérifier");
    await page.getByRole("radio").nth(0).check();

    const builder = page.locator(".course-quiz-builder");
    await expect(builder).toContainText("Quelle démarche faut-il privilégier ?");
    await expect(page.locator(".course-studio-mobile-save")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertAccessibleMain(page, testInfo);
    await assertComfortableMobileTargets(page);
    await expect(builder).toHaveScreenshot("course-editor-quiz-builder-mobile.png");
    assertNoRuntimeErrors(page);
  });
});

test("@mobile-webkit focused workspaces support real touch navigation", async ({ page }, testInfo) => {
  monitorRuntimeErrors(page);
  await mockApplicationApis(page);

  await page.goto(`/cours/${course.slug}`);
  await page.getByRole("link", { name: /Reprendre le module 1/ }).tap();
  await expect(page.getByRole("heading", { level: 1, name: course.modules[0].titre })).toBeVisible();
  const plan = page.locator(".module-mobile-plan");
  await plan.locator("summary").tap();
  await expect(plan).toHaveAttribute("open", "");
  await assertNoHorizontalOverflow(page);
  await assertAccessibleMain(page, testInfo);
  await assertComfortableMobileTargets(page);

  await page.goto(`/admin/courses?course=${course.slug}`);
  await openProgrammeByTouch(page);
  await expect(page.getByRole("textbox", { name: "Contenu du module 1" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await assertAccessibleMain(page, testInfo);
  await assertComfortableMobileTargets(page);
  assertNoRuntimeErrors(page);
});

test("editor keyboard and save workflow work without touching persistent course data", async ({ page }) => {
  monitorRuntimeErrors(page);
  await mockApplicationApis(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/admin/courses?course=${course.slug}`);

  const title = page.getByLabel("Titre du cours *");
  await expect(title).toHaveValue(course.titre);
  await title.fill(`${course.titre} — révisé`);
  const save = page.getByRole("button", { name: "Mettre à jour", exact: true });
  await expect(save).toBeEnabled();

  await page.getByRole("button", { name: /Programme/ }).click();
  const editor = page.getByRole("textbox", { name: "Contenu du module 1" });
  await editor.focus();
  await expect(editor).toBeFocused();
  await page.getByRole("button", { name: "Modifier le code HTML" }).click();
  await expect(page.getByRole("textbox", { name: "Contenu du module 1 — code HTML" })).toBeVisible();
  await page.getByRole("button", { name: "Revenir à l'éditeur visuel" }).click();

  page.once("dialog", dialog => dialog.accept());
  await save.click();
  await expect(page.getByText("Cours enregistré.")).toBeVisible();
  await expect(save).toBeDisabled();
  assertNoRuntimeErrors(page);
});

test("reader preferences persist and locked modules are not actionable", async ({ page }) => {
  monitorRuntimeErrors(page);
  await mockApplicationApis(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/cours/${course.slug}`);
  await expect(page.getByText("Verrouillé", { exact: true })).toBeVisible();
  const lockedModule = page.locator(".course-syllabus-item").filter({ hasText: course.modules[1].titre });
  await expect(lockedModule.getByRole("link")).toHaveCount(0);

  await page.goto(`/cours/${course.slug}/modules/${course.modules[0].id}`);
  await page.getByRole("button", { name: "Augmenter la taille du texte" }).click();
  await expect(page.getByRole("button", { name: "Augmenter la taille du texte" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Augmenter la taille du texte" })).toHaveAttribute("aria-pressed", "true");
  assertNoRuntimeErrors(page);
});

test("editor keeps each task focused and protects a local draft across reload", async ({ page }) => {
  monitorRuntimeErrors(page);
  await mockApplicationApis(page);
  await page.goto(`/admin/courses?course=${course.slug}`);
  const title = page.getByLabel("Titre du cours *");
  await expect(title).toHaveValue(course.titre);
  await title.fill(`${course.titre} — brouillon local`);
  await page.waitForTimeout(950);
  await expect(page.getByText("Brouillon local enregistré sur cet appareil.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Brouillon local disponible" })).toBeVisible();
  await page.getByRole("button", { name: "Restaurer" }).click();
  await page.getByRole("button", { name: /Vue d’ensemble/ }).click();
  await expect(page.getByLabel("Titre du cours *")).toHaveValue(`${course.titre} — brouillon local`);
  await page.getByRole("button", { name: /Pédagogie/ }).click();
  await expect(page.getByLabel("Titre du cours *")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Repères pédagogiques" })).toBeVisible();
  assertNoRuntimeErrors(page);
});
