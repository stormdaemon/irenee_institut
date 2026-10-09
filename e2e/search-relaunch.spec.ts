import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({storageState:{cookies:[],origins:[]}});

test("search landing page is readable on mobile and links to real recovered articles", async ({page,request}) => {
  await page.setViewportSize({width:320,height:820});
  await page.goto("/apologetique-pour-etudiants");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',/\/apologetique-pour-etudiants$/);
  await expect(page.getByRole('heading',{level:1})).toContainText('pour étudiants');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
  expect(audit.violations).toEqual([]);
  for (const path of ["/blog/qu-est-ce-que-l-apologetique-catholique","/blog/saint-irenee-docteur-unite-foi-recue","/blog/miracles-et-credibilite-eglise","/blog/tertullien-parler-juste-monde-hostile"]) {
    const response=await request.get(path); expect(response.status()).toBe(200);
    const html=await response.text(); expect(html).toContain(`href="https://apostolos-saint-irenee.duckdns.org${path}"`);expect(html).toContain('BlogPosting');
  }
  const missing=await request.get('/blog/article-qui-n-existe-pas');expect(missing.status()).toBe(404);
});
