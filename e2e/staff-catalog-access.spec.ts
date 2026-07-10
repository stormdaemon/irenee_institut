import { expect, test } from "@playwright/test";

test("director catalog access never opens or advertises the annual-pass checkout", async ({ page }) => {
  await page.goto("/formations?checkout=annual-pass");

  await expect(page.getByText("Accès équipe actif", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ouvrir les cours" }).first()).toHaveAttribute("href", "/espace-etudiant");
  await expect(page.locator('a[href="/formations?checkout=annual-pass"]')).toHaveCount(0);
  await expect(page.getByText("Prévisualisation sans pass", { exact: true })).toBeVisible();
});

test.describe("anonymous catalog", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("keeps the annual-pass purchase path for an anonymous visitor", async ({ page }) => {
    await page.goto("/formations");

    await expect(page.getByRole("button", { name: "Obtenir le pass annuel" })).toBeVisible();
    await expect(page.getByText("Accès équipe actif", { exact: true })).toHaveCount(0);
    await expect(page.locator('a[href="/formations?checkout=annual-pass"]').first()).toBeVisible();
  });
});
