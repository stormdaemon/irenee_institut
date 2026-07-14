import { expect, test } from "@playwright/test";

test.describe("registration access hotfix", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("restores the five-field registration flow and continues after account creation", async ({ page }) => {
    const password = "une-phrase-de-passe-solide-2026";

    await page.route("**/api/auth/signup", async route => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toMatchObject({
        email: "nouveau.compte@example.test",
        metadata: { nom: "Martin", prenom: "Claire" },
        next: "/formations?checkout=annual-pass",
        password,
        passwordConfirmation: password
      });
      const user = {
        email: "nouveau.compte@example.test",
        id: "browser-signup-user",
        identities: [{ id: "browser-signup-identity", provider: "email" }]
      };
      await route.fulfill({
        body: JSON.stringify({
          automationWarning: false,
          next: "/formations?checkout=annual-pass",
          session: {
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "cookie",
            user
          },
          user
        }),
        contentType: "application/json",
        status: 201
      });
    });

    await page.goto("/inscription");
    await expect(page.getByLabel(/^Mot de passe/)).toBeVisible();
    await expect(page.getByLabel("Confirmer le mot de passe", { exact: true })).toBeVisible();
    await page.getByLabel("Prénom").fill("Claire");
    await page.getByLabel("Nom", { exact: true }).fill("Martin");
    await page.getByLabel("Email").fill("nouveau.compte@example.test");
    await page.getByLabel(/^Mot de passe/).fill(password);
    await page.getByLabel("Confirmer le mot de passe", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page).toHaveURL(/\/formations\?checkout=annual-pass$/);
  });

  test("reuses the freshly reset password for the normal login and continues checkout", async ({ page }) => {
    const newPassword = "une-phrase-de-passe-neuve-2026";

    await page.route("**/api/auth/password/reset/complete", async route => {
      expect(route.request().postDataJSON()).toEqual({
        code: "reset-token-for-browser-test",
        password: newPassword,
        passwordConfirmation: newPassword
      });
      await route.fulfill({
        body: JSON.stringify({
          loginEmail: "compte.existant@example.test",
          ok: true,
          reauthenticationRequired: true
        }),
        contentType: "application/json",
        status: 200
      });
    });

    await page.route("**/api/auth/login", async route => {
      expect(route.request().postDataJSON()).toEqual({
        email: "compte.existant@example.test",
        password: newPassword
      });
      const user = { email: "compte.existant@example.test", id: "browser-hotfix-user" };
      await route.fulfill({
        body: JSON.stringify({
          session: { expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "cookie", user },
          user
        }),
        contentType: "application/json",
        status: 200
      });
    });

    await page.goto(
      "/auth/password-reset?next=%2Fformations%3Fcheckout%3Dannual-pass#code=reset-token-for-browser-test"
    );
    await page.locator("#new-password").fill(newPassword);
    await page.getByLabel("Confirmer le nouveau mot de passe").fill(newPassword);
    await page.getByRole("button", { name: "Modifier mon mot de passe" }).click();

    await expect(page).toHaveURL(/\/formations\?checkout=annual-pass$/);
  });
});
