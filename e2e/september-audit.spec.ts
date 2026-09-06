import { expect, test } from "@playwright/test";
import { getUpcomingVisioSessions } from "../lib/live-sessions";

test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [1440, 390]) {
  test(`public agenda and registration remain usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const agenda = page.locator("#agenda");
    const nextSession = getUpcomingVisioSessions()[0];
    await expect(agenda.getByRole("heading", { name: "Prochaines rencontres en visioconférence" })).toBeVisible();
    await expect(agenda.getByText(/99 € conseillés, participation libre/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    if (nextSession) {
      await expect(agenda.locator(".visio-spotlight h3")).toHaveText(nextSession.title);
      await expect(agenda.getByRole("link", { name: "Participer", exact: true }).first()).toHaveAttribute("href", `/direct/${nextSession.liveSessionId}`);
      await agenda.locator(".visio-spotlight").scrollIntoViewIfNeeded();
      await expect(agenda.locator(".visio-spotlight img")).toBeVisible();
      await expect.poll(() => agenda.locator(".visio-spotlight img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await agenda.locator(".visio-spotlight").screenshot({ path: testInfo.outputPath(`agenda-${width}.png`) });
    } else {
      await expect(agenda.getByText(/Les prochaines dates seront annoncées ici/)).toBeVisible();
    }
    await page.goto("/inscription");
    for (const name of ["Prénom", "Nom", "Téléphone", "Email", "Confirmer le mot de passe"]) {
      await expect(page.getByLabel(name, { exact: true })).toBeVisible();
    }
  });
}

test("the annual pass preserves free contributions and reports checkout failure honestly", async ({ page }) => {
  const user = { id: "test-student", email: "student@example.test" };
  await page.route("**/api/auth/user", route => route.fulfill({ json: { user, session: { user, expires_at: 2000000000, token_type: "cookie" } } }));
  await page.route("**/api/payments/checkout", async route => {
    expect(route.request().postDataJSON()).toMatchObject({ amount: "25" });
    await route.fulfill({ status: 503, json: { ok: false, error: "Le paiement est momentanément indisponible." } });
  });
  await page.goto("/formations");
  await page.getByRole("button", { name: /Obtenir le pass annuel/i }).first().click();
  await page.getByLabel("Montant libre en euros").fill("25");
  await page.getByRole("button", { name: /Continuer|paiement|Payer/i }).last().click();
  await expect(page.getByText("Le paiement est momentanément indisponible.", { exact: true })).toBeVisible();
});

test("public pages preserve SEO and technical downloads require authentication", async ({ page, request }) => {
  for (const path of ["/mentions-legales", "/politique-confidentialite", "/cgv"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://irenee-institut.org${path}`);
  }
  for (const path of ["/api/download/rapport", "/api/download/apps-script-partage"]) {
    expect((await request.get(`${path}?code=obsolete`)).status()).toBe(401);
  }
});
