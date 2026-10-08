import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the shared interface is dark, contemporary and readable on public pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/formations", "/blog", "/auth/login"]) {
    await page.goto(path);
    const theme = await page.evaluate(() => {
      const css = getComputedStyle(document.body);
      const rgb = css.backgroundColor.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      return { brightness: Math.max(...rgb), font: css.fontFamily, heading: getComputedStyle(document.querySelector("h1")!).fontFamily };
    });
    expect(theme.brightness).toBeLessThan(40);
    expect(theme.font).toContain("Manrope");
    expect(theme.heading).toContain("Sora");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("motion reveals content during scrolling and does not block navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "enabled");
  const card = page.locator(".apostolos-course-tile").first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute("data-motion-state", "visible");
  await expect(card).toHaveCSS("opacity", "1");
  await card.click();
  await expect(page).toHaveURL(/\/formations#cours-/);
  await expect(page.locator("main h1")).toBeVisible();
});

test("reduced motion keeps every section visible and stops decorative animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  const state = await page.evaluate(() => ({
    hidden: [...document.querySelectorAll("[data-motion-state]")].filter(el => getComputedStyle(el).opacity === "0").length,
    active: document.getAnimations().filter(animation => animation.playState === "running").length,
  }));
  expect(state).toEqual({ hidden: 0, active: 0 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "enabled");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
});
