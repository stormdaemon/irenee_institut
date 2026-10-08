import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`blog and team pages are linked and identify Théo Lafont at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/blog");

    if (width < 800) {
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
      await page.getByRole("navigation", { name: "Navigation mobile" }).getByRole("link", { name: "L’équipe" }).click();
    } else {
      await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "L’équipe" }).click();
    }

    await expect(page).toHaveURL(/\/equipe$/);
    await expect(page.getByRole("heading", { name: /Des voix, des savoirs/ })).toBeVisible();
    await expect(page.getByText("Théo Lafont")).toBeVisible();
    await expect(page.getByText("Directeur", { exact: true })).toBeVisible();
    const portrait = page.getByRole("img", { name: "Théo Lafont" });
    await expect(portrait).toBeVisible();
    await expect.poll(() => portrait.evaluate(image => (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  });
}
