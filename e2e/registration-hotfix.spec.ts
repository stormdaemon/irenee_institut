import { expect, test } from "@playwright/test";

test.describe("registration access hotfix", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("gives both new and existing accounts an accurate recovery path", async ({ page }) => {
    await page.route("**/api/auth/signup", async route => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toMatchObject({
        email: "compte.existant@example.test",
        metadata: { nom: "Martin", prenom: "Claire" },
        next: "/formations?checkout=annual-pass"
      });
      await route.fulfill({
        body: JSON.stringify({
          confirmationRequired: true,
          message: "Si une confirmation est nécessaire, un lien vient d'être envoyé.",
          session: null,
          user: { email: "compte.existant@example.test" }
        }),
        contentType: "application/json",
        status: 202
      });
    });

    await page.goto("/inscription");
    await page.getByLabel("Prénom").fill("Claire");
    await page.getByLabel("Nom", { exact: true }).fill("Martin");
    await page.getByLabel("Email").fill("compte.existant@example.test");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page.getByText("Vérifiez votre boîte mail", { exact: true })).toBeVisible();
    await expect(page.getByText("activer un nouveau compte ou de récupérer l’accès", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "J’ai déjà mon mot de passe" })).toHaveAttribute(
      "href",
      "/auth/login?next=%2Fformations%3Fcheckout%3Dannual-pass"
    );
    await expect(page.getByRole("link", { name: "Je n’ai pas reçu l’e-mail" })).toHaveAttribute(
      "href",
      "/auth/password-forgot"
    );
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
