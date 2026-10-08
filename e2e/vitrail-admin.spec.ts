import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The global setup supplies an isolated CI director, never a production account.
for(const path of ["/admin","/admin/users","/admin/payments","/admin/access","/admin/settings","/admin/stats","/admin/legal","/admin/live","/admin/homework"]){
 test(`administration ${path} remains readable and usable on mobile`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(path);
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page.locator(".apostolos-brand img").first()).toHaveAttribute("src",/vitrail/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
  expect(audit.violations,path).toEqual([]);
  await expect(page).toHaveScreenshot(`vitrail${path.replaceAll('/','-')}-mobile.png`);
 });
}
