import { expect, test } from "@playwright/test";

test.describe("ZAP production hotfix", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cspViolations: string[] }).__cspViolations = [];
      document.addEventListener("securitypolicyviolation", event => {
        (window as unknown as { __cspViolations: string[] }).__cspViolations.push(
          `${event.effectiveDirective}:${event.blockedURI}`
        );
      });
    });
  });

  test("canonicalizes scanner payloads and keeps redirects empty", async ({ request }) => {
    const checkout = await request.get("/formations?checkout=annual-pass%27%20OR%20%271%27=%271", { maxRedirects: 0 });
    expect(checkout.status()).toBe(307);
    expect(checkout.headers().location).toBe("/formations");
    expect((await checkout.body()).length).toBeLessThan(256);

    const login = await request.get("/auth/login?email=victim%40example.test&password=ZAP&next=%2Fadmin", { maxRedirects: 0 });
    expect(login.status()).toBe(302);
    expect(login.headers().location).toBe("/auth/login?next=%2Fadmin");
    expect((await login.body()).length).toBeLessThan(256);

    const admin = await request.get("/admin", { maxRedirects: 0 });
    expect(admin.status()).toBe(307);
    expect(admin.headers().location).toBe("/auth/login?next=%2Fadmin");
    expect((await admin.body()).length).toBeLessThan(256);
  });

  test("loads key pages under the narrowed style policy", async ({ page }) => {
    for (const path of ["/", "/formations", "/contact"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      const csp = response?.headers()["content-security-policy"] || "";
      expect(csp).toContain("style-src-attr 'unsafe-inline'");
      expect(csp).toContain("style-src-elem 'self' 'nonce-");
      expect(csp).not.toContain("style-src 'self' 'unsafe-inline'");
      await expect(page.locator("body")).toBeVisible();
      const violations = await page.evaluate(() => (
        window as unknown as { __cspViolations: string[] }
      ).__cspViolations);
      expect(violations).toEqual([]);
    }
  });

  test("contact form uses the same-origin JSON endpoint", async ({ page }) => {
    await page.route("**/api/contact", async route => {
      const request = route.request();
      expect(request.method()).toBe("POST");
      expect(request.headers()["content-type"]).toContain("application/json");
      expect(request.postDataJSON()).toMatchObject({
        email: "marie@example.test",
        nom: "Durand",
        prenom: "Marie",
        sujet: "Formation"
      });
      await route.fulfill({
        body: JSON.stringify({ accepted: true }),
        contentType: "application/json",
        status: 202
      });
    });

    await page.goto("/contact");
    await page.getByLabel("Prénom *").fill("Marie");
    await page.getByLabel("Nom *", { exact: true }).fill("Durand");
    await page.getByLabel("Email *").fill("marie@example.test");
    await page.getByLabel("Sujet *").selectOption("Formation");
    await page.getByLabel("Message *").fill("Bonjour, je souhaite recevoir des précisions sur la formation.");
    await page.getByRole("button", { name: "Envoyer le message" }).click();

    await expect(page.getByText("Votre message a bien été envoyé.", { exact: false })).toBeVisible();
  });
});
