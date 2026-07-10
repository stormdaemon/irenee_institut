import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type Route, type TestInfo } from "@playwright/test";

const profile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "qa-director@irenee.test",
  prenom: "QA",
  nom: "Visuel",
  role: "directeur"
};

const studentProfile = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "qa-student@irenee.test",
  prenom: "Camille",
  nom: "Étudiant",
  role: "etudiant"
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
        <p><a href="/ressources-apologetique">Consulter une ressource complémentaire</a><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="></p>
        <div class="definition-box modal-backdrop"><h3>Définition</h3><p>L'apologétique expose les raisons de croire avec précision et respect.</p></div>
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
      url_sous_titres: "",
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
      url_sous_titres: "",
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
  profile?: typeof profile;
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
  const currentProfile = () => options.profile
    || (new URL(page.url()).pathname.startsWith("/admin") ? profile : studentProfile);

  await page.route("**/api/auth/user", route => {
    const activeProfile = currentProfile();
    return fulfillJson(route, {
      session: { expires_at: 4_102_444_800, token_type: "cookie", user: activeProfile },
      user: activeProfile
    });
  });
  await page.route("**/api/auth/profile", route => fulfillJson(route, { profile: currentProfile() }));
  await page.route("**/api/learning/courses/cours-qa-visuel/modules/**", route => {
    const activeProfile = currentProfile();
    return fulfillJson(route, {
      accessMode: activeProfile.role === "etudiant" ? "learning" : "preview",
      course: {
        ...mockedCourse,
        modules: mockedCourse.modules.map(({ contenu, contenu_html, quiz, ressources, url_video, url_sous_titres, ...module }) => module)
      },
      module: {
        ...mockedModule,
        contenu_html: `${hostileLegacyStyleBlock}${mockedModule.contenu_html || mockedModule.contenu || ""}`
      },
      ok: true,
      profile: activeProfile,
      progress: mockedProgress
    });
  });
  await page.route("**/api/learning/courses/cours-qa-visuel", route => {
    const activeProfile = currentProfile();
    return fulfillJson(route, {
      accessMode: activeProfile.role === "etudiant" ? "learning" : "preview",
      course: mockedCourse,
      ok: true,
      profile: activeProfile,
      progress: mockedProgress
    });
  });
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

async function assertAccessibleCourseFrame(page: Page) {
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  expect(frame, "Le document pédagogique isolé doit être chargé.").toBeTruthy();
  if (!frame) return;
  const report = await frame.evaluate(() => {
    const headings = Array.from(document.querySelectorAll<HTMLElement>("h2, h3, h4"));
    const headingLevels = headings.map(heading => Number(heading.tagName.slice(1)));
    return {
      linksWithoutName: Array.from(document.querySelectorAll<HTMLAnchorElement>("a")).filter(link => {
        const imageAlt = link.querySelector("img")?.getAttribute("alt")?.trim() || "";
        return !(link.textContent?.trim() || link.getAttribute("aria-label")?.trim() || imageAlt);
      }).length,
      missingImageAlt: document.querySelectorAll("img:not([alt])").length,
      unsafeLinks: Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).filter(link => {
        const href = link.getAttribute("href") || "";
        return !((href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) || /^(?:https:|mailto:|tel:)/i.test(href));
      }).length,
      headingJumps: headingLevels.filter((level, index) => index > 0 && level > headingLevels[index - 1] + 1).length,
      unlabeledResponsiveCells: document.querySelectorAll(".module-responsive-table tbody td:not([data-label])").length,
    };
  });
  expect(report).toEqual({
    headingJumps: 0,
    linksWithoutName: 0,
    missingImageAlt: 0,
    unlabeledResponsiveCells: 0,
    unsafeLinks: 0,
  });
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
  const table = page.locator(".course-program-editor .rich-canvas table").first();
  const scroller = table;
  const firstCell = table.locator("tbody tr").first().locator("td").first();
  await expect(scroller).toBeVisible();
  await expect(table).toBeVisible();
  await expect(firstCell).toBeVisible();
  await expect(firstCell).toHaveCSS("position", "sticky");
  const before = await scroller.evaluate(element => ({
    clientWidth: element.clientWidth,
    overflowX: getComputedStyle(element).overflowX,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth
  }));
  expect(before.scrollWidth, "The stress-test table should overflow at a mobile width.").toBeGreaterThan(before.clientWidth + 1);
  expect(["auto", "scroll"], "The overflowing table must expose a reachable horizontal scroller.").toContain(before.overflowX);

  await scroller.evaluate(element => { element.scrollLeft = (element.scrollWidth - element.clientWidth) * .45; });
  const [scrollerBoxAtMiddle, firstCellBoxAtMiddle, middle] = await Promise.all([
    scroller.boundingBox(),
    firstCell.boundingBox(),
    scroller.evaluate(element => ({ scrollLeft: element.scrollLeft, maximum: element.scrollWidth - element.clientWidth }))
  ]);
  expect(middle.scrollLeft, "The table must reach an intermediate horizontal position.").toBeGreaterThan(0);
  expect(middle.scrollLeft, "The intermediate position must remain distinct from the final column.").toBeLessThan(middle.maximum);

  await scroller.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  const [after, firstCellBoxAtEnd] = await Promise.all([
    scroller.evaluate(element => ({ scrollLeft: element.scrollLeft, maximum: element.scrollWidth - element.clientWidth })),
    firstCell.boundingBox()
  ]);
  expect(after.scrollLeft, "The table must move when scrolled to its last column.").toBeGreaterThan(0);
  expect(after.scrollLeft).toBeCloseTo(after.maximum, 0);
  expect(scrollerBoxAtMiddle, "The horizontal scroller must remain measurable.").not.toBeNull();
  expect(firstCellBoxAtMiddle, "The sticky first cell must remain measurable midway through the pan.").not.toBeNull();
  expect(firstCellBoxAtEnd, "The sticky first cell must remain measurable at the final column.").not.toBeNull();
  if (scrollerBoxAtMiddle && firstCellBoxAtMiddle && firstCellBoxAtEnd) {
    expect(
      Math.abs(firstCellBoxAtEnd.x - firstCellBoxAtMiddle.x),
      "The first table cell must stay fixed while the remaining columns move underneath it."
    ).toBeLessThanOrEqual(1);
    expect(firstCellBoxAtEnd.x).toBeGreaterThanOrEqual(scrollerBoxAtMiddle.x - 1);
    expect(firstCellBoxAtEnd.x + firstCellBoxAtEnd.width).toBeLessThanOrEqual(
      scrollerBoxAtMiddle.x + scrollerBoxAtMiddle.width + 1
    );
  }

  const lastCell = table.locator("tr").last().locator("th, td").last();
  const [scrollerBox, cellBox] = await Promise.all([scroller.boundingBox(), lastCell.boundingBox()]);
  expect(scrollerBox).not.toBeNull();
  expect(cellBox).not.toBeNull();
  if (scrollerBox && cellBox) {
    expect(cellBox.x + cellBox.width).toBeLessThanOrEqual(scrollerBox.x + scrollerBox.width + 1);
    expect(cellBox.x).toBeGreaterThanOrEqual((firstCellBoxAtEnd?.x || scrollerBox.x) + (firstCellBoxAtEnd?.width || 0) - 1);
  }
}

async function openProgrammeByTouch(page: Page) {
  await expect(page.getByLabel("Cours actif")).toHaveValue(course.id);
  const programme = page.getByRole("button", { name: /Programme/ });
  await programme.scrollIntoViewIfNeeded();
  await expect(programme).toBeVisible();
  await expect(programme).toBeEnabled();
  await programme.tap();
  if (await programme.getAttribute("aria-current") !== "step") await programme.tap();
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
      const progressCopy = page.locator(".course-progress-summary > div:not(.course-progress-dial)");
      await expect(progressCopy.locator("strong")).toHaveText("0 sur 2");
      await expect(progressCopy.locator("strong")).toHaveCSS("color", "rgb(16, 43, 70)");
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
      await expect(contentFrame.locator(".definition-box")).toHaveAttribute("class", "definition-box");
      await expect(contentFrame.locator(".modal-backdrop")).toHaveCount(0);
      await waitForStableUi(page);
      await assertStableCourseFrame(page);
      await assertAccessibleCourseFrame(page);
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
      const normalizedLink = await contentFrame.getByRole("link", { name: "Consulter une ressource complémentaire" }).evaluate(element => {
        const style = getComputedStyle(element);
        return { color: style.color, decoration: style.textDecorationLine, fontWeight: style.fontWeight };
      });
      expect(normalizedLink).toMatchObject({ color: "rgb(122, 23, 23)", decoration: "underline" });
      if (viewport.width === 320) {
        const clippedCells = await contentFrame.locator(".module-responsive-table td").evaluateAll(cells => cells
          .filter(cell => cell.scrollWidth > cell.clientWidth + 1)
          .map(cell => cell.textContent?.trim() || "cellule"));
        expect(clippedCells, "Les valeurs du tableau étudiant doivent rester entièrement lisibles à 320 px.").toEqual([]);
      }
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
      if (viewport.width <= 390) {
        const coverPreview = page.locator(".course-cover-preview");
        await expect(coverPreview.locator("p")).toBeVisible();
        await expect(coverPreview.locator(".course-cover-preview-meta")).toBeVisible();
      }
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
      if (viewport.width <= 390) {
        await expect(page.locator(".rich-toolbar-mobile-hint")).toBeVisible();
        await expect(page.locator(".rich-table-hint")).toBeVisible();
        await expect(page.locator(".course-program-editor .rich-canvas td").first()).toHaveCSS("position", "sticky");
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      if (viewport.width <= 390) await expect(page.locator(".course-program-mobile-actions")).toBeVisible();
      if (viewport.width === 320) {
        const titleBox = await page.getByLabel("Titre du module *").boundingBox();
        expect(titleBox, "Le premier champ du module doit être présent dans le premier écran mobile.").not.toBeNull();
        if (titleBox) expect(titleBox.y + titleBox.height, "Le titre du module doit être éditable sans premier défilement à 320×568.").toBeLessThanOrEqual(viewport.height);
      }
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
    await expect(courseSwitch).toHaveValue(course.id);
    await courseSwitch.selectOption("");
    await expect(courseSwitch).toHaveValue("");
    await expect(page.getByLabel("Titre du cours *")).toHaveValue("");
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
    await expect(page.locator(".course-studio-mobile-save")).toContainText("Brouillon local protégé", { timeout: 3_000 });
    await page.reload();

    const recovery = page.getByRole("heading", { name: "Brouillon local disponible" });
    await expect(recovery).toBeVisible();
    await expect(page.getByRole("button", { name: "Restaurer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refuser" })).toBeVisible();
    await expect(page).toHaveScreenshot("course-editor-recovery-mobile.png");
    assertNoRuntimeErrors(page);
  });

  test("published course exposes its mobile reader shortcut", async ({ page }) => {
    monitorRuntimeErrors(page);
    await mockApplicationApis(page);
    await page.goto(`/admin/courses?course=${course.slug}`);

    const readCourse = page.locator(".course-studio-mobile-read");
    await expect(readCourse).toBeVisible();
    await expect(readCourse).toHaveAccessibleName("Lire le cours dans un nouvel onglet");
    await expect(readCourse).toHaveAttribute("href", `/cours/${course.slug}`);
    await expect(readCourse).toHaveAttribute("target", "_blank");
    await expect(readCourse).toHaveAttribute("rel", /noopener/);
    await assertComfortableMobileTargets(page);
    assertNoRuntimeErrors(page);
  });

  test("mobile editor previews a video only with its WebVTT captions", async ({ page }) => {
    const videoModule = {
      ...course.modules[1],
      url_video: "/videos/presentation-institut-saint-irenee-samy.mp4",
      url_sous_titres: "/qa-course-fr.vtt",
    };
    const videoCourse = { ...course, modules: [course.modules[0], videoModule] } as MockCourse;
    await page.route("**/qa-course-fr.vtt", route => route.fulfill({
      body: "WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nBienvenue dans ce module.\n",
      contentType: "text/vtt; charset=utf-8",
      status: 200,
    }));
    monitorRuntimeErrors(page);
    await mockApplicationApis(page, { course: videoCourse, module: videoModule as MockModule });
    await page.goto(`/admin/courses?course=${course.slug}`);
    await openProgrammeByTouch(page);
    await page.getByLabel("Module actif", { exact: true }).selectOption(`saved-module-${videoModule.id}`);

    await expect(page.getByLabel("Sous-titres WebVTT (.vtt) *")).toHaveValue("/qa-course-fr.vtt");
    await page.locator(".course-program-mobile-actions").getByRole("button", { name: "Aperçu", exact: true }).tap();
    const preview = page.getByLabel(`Aperçu sécurisé de ${videoModule.titre}`);
    const track = preview.locator("track[kind='captions']");
    await expect(preview.locator("video")).toBeVisible();
    await expect(track).toHaveAttribute("src", "/qa-course-fr.vtt");
    await expect(track).toHaveAttribute("srclang", "fr");
    await expect(preview).toHaveScreenshot("course-editor-video-captions-mobile.png");
    await assertNoHorizontalOverflow(page);
    assertNoRuntimeErrors(page);
  });

  test("mobile module actions reorder and delete the active module without saving", async ({ page }) => {
    const courseWriteRequests: string[] = [];
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/courses") && request.method() !== "GET") {
        courseWriteRequests.push(`${request.method()} ${url.pathname}`);
      }
    });
    monitorRuntimeErrors(page);
    await mockApplicationApis(page);
    await page.goto(`/admin/courses?course=${course.slug}`);
    await openProgrammeByTouch(page);

    const moduleSwitch = page.getByLabel("Module actif");
    const options = moduleSwitch.locator("option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toHaveText(`1. ${course.modules[0].titre}`);
    await expect(options.nth(1)).toHaveText(`2. ${course.modules[1].titre}`);

    const moreActions = page.locator("summary[aria-label='Plus d’actions sur le module actif']");
    await moreActions.tap();
    const moveUpFirst = page.getByRole("button", { name: "Monter le module 1" });
    const moveDownFirst = page.getByRole("button", { name: "Descendre le module 1" });
    const deleteFirst = page.getByRole("button", { name: "Supprimer le module 1" });
    await expect(moveUpFirst).toBeVisible();
    await expect(moveUpFirst).toBeDisabled();
    await expect(moveDownFirst).toBeVisible();
    await expect(moveDownFirst).toBeEnabled();
    await expect(deleteFirst).toBeVisible();
    await expect(deleteFirst).toBeEnabled();

    await moveDownFirst.tap();
    await expect(options.nth(0)).toHaveText(`1. ${course.modules[1].titre}`);
    await expect(options.nth(1)).toHaveText(`2. ${course.modules[0].titre}`);
    const moveUpSecond = page.getByRole("button", { name: "Monter le module 2" });
    await expect(moveUpSecond).toBeEnabled();
    await moveUpSecond.tap();
    await expect(options.nth(0)).toHaveText(`1. ${course.modules[0].titre}`);
    await expect(options.nth(1)).toHaveText(`2. ${course.modules[1].titre}`);

    let confirmation = "";
    page.once("dialog", async dialog => {
      confirmation = dialog.message();
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Supprimer le module 1" }).tap();
    await expect(options).toHaveCount(1);
    await expect(options.nth(0)).toHaveText(`1. ${course.modules[1].titre}`);
    expect(confirmation).toContain(course.modules[0].titre);
    expect(courseWriteRequests, "Reordering and deleting stay local until the user explicitly saves.").toEqual([]);
    await expect(page.locator(".course-studio-mobile-save")).toBeVisible();
    await assertComfortableMobileTargets(page);
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
    const progressStarted = page.waitForResponse(response => (
      response.request().method() === "POST" && new URL(response.url()).pathname === "/api/progress/update"
    ));
    await page.goto(`/cours/${course.slug}/modules/${quizModule.id}`);
    await progressStarted;
    await page.getByLabel("Comprendre la question").check();
    await expect(page.getByLabel("Comprendre la question")).toBeChecked();

    const quiz = page.locator(".course-quiz-card");
    await expect(quiz).toBeVisible();
    await expect(quiz.locator(".course-quiz-question")).toHaveCSS("background-color", "rgb(251, 248, 241)");
    await expect(quiz.locator(".course-quiz-question")).toHaveCSS("box-shadow", "none");
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
  await page.locator(".reader-preferences > summary").click();
  await page.getByRole("button", { name: "Augmenter la taille du texte" }).click();
  await expect(page.getByRole("button", { name: "Augmenter la taille du texte" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.locator(".reader-preferences > summary").click();
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

test.describe("reader journey functional regressions", () => {
  for (const staffRole of ["directeur", "formateur"] as const) {
    test(`${staffRole} can preview a learner-locked module without writing progress`, async ({ page }) => {
      const staffProfile = {
        ...profile,
        email: `qa-${staffRole}@irenee.test`,
        role: staffRole
      };
      const progressPosts: string[] = [];
      page.on("request", request => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/api/progress/update") {
          progressPosts.push(request.postData() || "<empty>");
        }
      });

      monitorRuntimeErrors(page);
      await mockApplicationApis(page, {
        module: course.modules[1],
        profile: staffProfile
      });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/cours/${course.slug}`);
      const availableModule = page.locator(".course-syllabus-item").filter({ hasText: course.modules[1].titre });
      await expect(availableModule.getByText("Accessible", { exact: true })).toBeVisible();
      await expect(availableModule.getByRole("link", { name: "Prévisualiser" })).toHaveAttribute(
        "href",
        `/cours/${course.slug}/modules/${course.modules[1].id}`,
      );

      await page.goto(`/cours/${course.slug}/modules/${course.modules[1].id}`);

      await expect(page.getByRole("heading", { level: 1, name: course.modules[1].titre })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Mode aperçu équipe" })).toContainText(
        "Aucune progression ni attestation ne sera créée."
      );
      await expect(page.getByRole("region", { name: "Fin de la prévisualisation" })).toBeVisible();

      const desktopPlan = page.locator(".module-plan-sidebar .module-course-plan");
      await expect(desktopPlan.getByRole("link")).toHaveCount(course.modules.length);
      await expect(desktopPlan.getByRole("link", { name: /Module 1/ })).toHaveAttribute(
        "href",
        `/cours/${course.slug}/modules/${course.modules[0].id}`
      );
      await expect(desktopPlan.getByRole("link", { name: /Module 2/ })).toHaveAttribute(
        "href",
        `/cours/${course.slug}/modules/${course.modules[1].id}`
      );
      await expect(desktopPlan.getByLabel(/verrouillé/i)).toHaveCount(0);

      // Both the automatic "start" mutation and the completion action must be
      // absent in preview mode. Wait past the reader's async start effect so a
      // late regression cannot make this negative assertion pass by accident.
      await page.waitForTimeout(900);
      expect(progressPosts, "Staff preview must never mutate learner progress.").toEqual([]);
      assertNoRuntimeErrors(page);
    });
  }

  test("reader restores the saved vertical position after reload", async ({ page }) => {
    monitorRuntimeErrors(page);
    await mockApplicationApis(page);
    await page.setViewportSize({ width: 390, height: 640 });
    await page.goto(`/cours/${course.slug}/modules/${course.modules[0].id}`);
    await expect(page.getByRole("heading", { level: 1, name: course.modules[0].titre })).toBeVisible();
    await expect(page.frameLocator("iframe[title^='Contenu du module']").getByRole("heading", {
      name: "Une lecture confortable, même sur mobile"
    })).toBeVisible();
    await waitForStableUi(page);

    const storageKey = `irenee:reader-position:v1:${studentProfile.id}:${course.slug}:${course.modules[0].id}`;
    // The storage state can contain a benign position saved while authenticating.
    // Clear it and let both initial restore timers elapse before exercising a
    // deliberate user scroll, otherwise the 700 ms settle pass can race the test.
    await page.evaluate(key => window.localStorage.removeItem(key), storageKey);
    await page.waitForTimeout(750);
    await expect.poll(
      () => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight),
      { message: "The isolated lesson must finish contributing its height before the restoration check.", timeout: 3_000 }
    ).toBeGreaterThan(300);
    const lessonBody = page.frameLocator("iframe[title^='Contenu du module']").locator(".module-content");
    await lessonBody.hover({ position: { x: 24, y: 180 } });
    await page.mouse.wheel(0, 900);
    await expect.poll(
      () => page.evaluate(() => window.scrollY),
      { message: "A real wheel gesture over the isolated lesson must scroll the parent reader." }
    ).toBeGreaterThan(300);
    const requestedPosition = await page.evaluate(() => window.scrollY);
    expect(requestedPosition, "The fixture must be long enough to exercise position restoration.").toBeGreaterThan(300);

    await expect.poll(
      () => page.evaluate(key => Number(window.localStorage.getItem(key)), storageKey),
      { message: "The throttled scroll listener must persist the reader position.", timeout: 2_000 }
    ).toBeGreaterThanOrEqual(requestedPosition - 2);
    const savedPosition = await page.evaluate(key => Number(window.localStorage.getItem(key)), storageKey);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: course.modules[0].titre })).toBeVisible();
    await expect.poll(async () => page.evaluate(expected => {
      const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const restoredTarget = Math.min(expected, maximum);
      return Math.abs(window.scrollY - restoredTarget);
    }, savedPosition), {
      message: "The reader must restore its localStorage position after its content height settles.",
      timeout: 3_000
    }).toBeLessThanOrEqual(12);
    assertNoRuntimeErrors(page);
  });

  test("reader opens sanitized lesson links outside the isolated document", async ({ page }) => {
    monitorRuntimeErrors(page);
    await mockApplicationApis(page);
    await page.goto(`/cours/${course.slug}/modules/${course.modules[0].id}`);
    const link = page.frameLocator("iframe[title^='Contenu du module']").getByRole("link", { name: "Consulter une ressource complémentaire" });
    await expect(link).toBeVisible();
    const popupPromise = page.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;
    await expect.poll(() => new URL(popup.url()).pathname).toBe("/ressources-apologetique");
    await popup.close();
    assertNoRuntimeErrors(page);
  });

  test("published video exposes and loads its French WebVTT captions", async ({ page }) => {
    const videoModule = {
      ...course.modules[1],
      url_video: "/videos/presentation-institut-saint-irenee-samy.mp4",
      url_sous_titres: "/qa-course-fr.vtt",
    };
    const videoCourse = { ...course, modules: [course.modules[0], videoModule] } as MockCourse;
    await page.route("**/qa-course-fr.vtt", route => route.fulfill({
      body: "WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nBienvenue dans ce module.\n",
      contentType: "text/vtt; charset=utf-8",
      status: 200,
    }));
    monitorRuntimeErrors(page);
    await mockApplicationApis(page, { course: videoCourse, module: videoModule as MockModule });
    await page.goto(`/cours/${course.slug}/modules/${videoModule.id}`);

    const video = page.locator("video.module-video-player");
    const track = video.locator("track[kind='captions']");
    await expect(video).toBeVisible();
    await expect(track).toHaveAttribute("src", "/qa-course-fr.vtt");
    await expect(track).toHaveAttribute("srclang", "fr");
    await expect(track).toHaveAttribute("label", "Français");
    await expect.poll(() => track.evaluate(element => (element as HTMLTrackElement).readyState), {
      message: "The WebVTT track must be fetched and parsed by the browser.",
    }).toBe(2);
    expect(await video.evaluate(element => {
      const textTracks = (element as HTMLVideoElement).textTracks;
      return { language: textTracks[0]?.language, length: textTracks.length, mode: textTracks[0]?.mode };
    })).toEqual({ language: "fr", length: 1, mode: "showing" });
    assertNoRuntimeErrors(page);
  });
});

test.describe("reader mobile plan stress", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 568 } });

  test("twenty-module plan stays contained, scrollable and fully reachable", async ({ page }) => {
    const stressModules = Array.from({ length: 20 }, (_, index) => ({
      ...course.modules[0],
      id: `00000000-0000-4000-8000-${String(300 + index).padStart(12, "0")}`,
      ordre: index + 1,
      titre: `Module de contrôle ${String(index + 1).padStart(2, "0")}`
    })) as MockModule[];
    const stressCourse = {
      ...course,
      modules: stressModules,
      nb_modules: stressModules.length
    } as MockCourse;

    monitorRuntimeErrors(page);
    await mockApplicationApis(page, {
      course: stressCourse,
      module: stressModules[12],
      profile
    });
    await page.goto(`/cours/${course.slug}/modules/${stressModules[12].id}`);
    await expect(page.getByRole("heading", { level: 1, name: stressModules[12].titre })).toBeVisible();

    const documentHeightBefore = await page.evaluate(() => document.documentElement.scrollHeight);
    const plan = page.locator(".module-mobile-plan");
    await plan.locator("summary").tap();
    await expect(plan).toHaveAttribute("open", "");

    const planScroller = plan.locator(".module-course-plan");
    await expect(planScroller.locator("li")).toHaveCount(stressModules.length);
    await expect(planScroller.getByRole("link")).toHaveCount(stressModules.length);
    const activeModule = planScroller.locator("li.is-active");
    await expect(activeModule).toHaveCount(1);
    await expect(activeModule).toContainText(stressModules[12].titre);
    await expect(activeModule.getByRole("link")).toHaveAttribute("aria-current", "step");
    await expect.poll(
      () => planScroller.evaluate(element => element.scrollTop),
      { message: "Opening a long mobile plan must automatically reveal its active module." }
    ).toBeGreaterThan(0);
    const activeContainment = await planScroller.evaluate(element => {
      const active = element.querySelector<HTMLElement>("li.is-active");
      if (!active) return null;
      const scrollerRect = element.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      return {
        activeBottom: activeRect.bottom,
        activeTop: activeRect.top,
        scrollerBottom: scrollerRect.bottom,
        scrollerTop: scrollerRect.top,
        scrollTop: element.scrollTop
      };
    });
    expect(activeContainment, "The active module and its plan scroller must be measurable.").not.toBeNull();
    if (activeContainment) {
      expect(activeContainment.scrollTop).toBeGreaterThan(0);
      expect(activeContainment.activeTop).toBeGreaterThanOrEqual(activeContainment.scrollerTop - 1);
      expect(activeContainment.activeBottom).toBeLessThanOrEqual(activeContainment.scrollerBottom + 1);
    }
    const scrollMetrics = await planScroller.evaluate(element => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight
    }));
    expect(scrollMetrics.scrollHeight, "A 20-module plan must use an internal vertical scroller.").toBeGreaterThan(scrollMetrics.clientHeight);
    expect(["auto", "scroll"], "The plan's overflow must remain reachable by touch.").toContain(scrollMetrics.overflowY);

    await planScroller.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const lastModule = planScroller.getByRole("link", { name: /Module 20/ });
    await expect(lastModule).toBeVisible();
    await expect(lastModule).toHaveAttribute(
      "href",
      `/cours/${course.slug}/modules/${stressModules[19].id}`
    );
    const containment = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".module-mobile-plan");
      const scroller = panel?.querySelector<HTMLElement>(".module-course-plan");
      const last = scroller?.querySelector<HTMLElement>("li:last-child a");
      if (!panel || !scroller || !last) return null;
      const panelRect = panel.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      return {
        documentHeight: document.documentElement.scrollHeight,
        lastBottom: lastRect.bottom,
        lastTop: lastRect.top,
        panelBottom: panelRect.bottom,
        panelLeft: panelRect.left,
        panelRight: panelRect.right,
        scrollerBottom: scrollerRect.bottom,
        scrollerTop: scrollerRect.top,
        viewportHeight: window.innerHeight,
        viewportWidth: document.documentElement.clientWidth
      };
    });
    expect(containment, "The mobile plan and final module must be measurable.").not.toBeNull();
    if (containment) {
      expect(containment.panelLeft).toBeGreaterThanOrEqual(0);
      expect(containment.panelRight).toBeLessThanOrEqual(containment.viewportWidth);
      expect(containment.panelBottom).toBeLessThanOrEqual(containment.viewportHeight);
      expect(containment.lastTop).toBeGreaterThanOrEqual(containment.scrollerTop - 1);
      expect(containment.lastBottom).toBeLessThanOrEqual(containment.scrollerBottom + 1);
      expect(containment.documentHeight, "Opening the fixed plan must not lengthen the reader page.").toBeLessThanOrEqual(documentHeightBefore + 1);
    }
    await assertNoHorizontalOverflow(page);
    await assertComfortableMobileTargets(page);
    assertNoRuntimeErrors(page);
  });
});
