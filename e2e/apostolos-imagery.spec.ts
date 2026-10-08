import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`illustrated public pages retain loaded artwork and usable navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/formations", "/blog", "/a-propos"]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toHaveCount(1);
      const hero = page.locator(path === "/" ? ".apostolos-sanctuary" : ".apostolos-editorial-banner");
      const image = hero.locator(":scope > img");
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      expect(await hero.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      if (width < 800) {
        await page.getByRole("button", { name: "Ouvrir le menu" }).click();
        await expect(page.getByRole("navigation", { name: "Navigation mobile" })).toBeVisible();
        await page.getByRole("button", { name: "Fermer le menu" }).click();
      }
    }
  });
}
