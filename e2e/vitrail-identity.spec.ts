import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
test.use({ storageState: { cookies: [], origins: [] } });
for (const width of [320,390,1086,1440]) {
 test(`approved homepage keeps artwork, links and stable hover boxes at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:1000});
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/");
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.getByRole("heading",{level:1})).toHaveText("Une foi vivante.Une pensée libre.");
  await expect(page.getByText("L’Institut est de retour",{exact:true})).toBeVisible();
  await expect(page.locator(".vitrail-domain")).toHaveCount(3);
  for(const img of await page.locator(".vitrail-home img").all()) {
   await img.scrollIntoViewIfNeeded();
   await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  }
  const button=page.getByRole("link",{name:"Explorer les formations"});
  await button.scrollIntoViewIfNeeded();
  const before=await button.boundingBox();expect(before!.height).toBeGreaterThanOrEqual(44);
  await button.hover();
  await expect(button).toHaveCSS("transform","none");
  // Observe the entire hover transition, including repeated edge entry.
  const samples=await button.evaluate(async el=>{const frames=[];for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect();frames.push([r.x,r.y,r.width,r.height]);}return frames});
  for(const [x,y,w,h] of samples){expect(Math.abs(x-before!.x)).toBeLessThan(.5);expect(Math.abs(y-before!.y)).toBeLessThan(.5);expect(w).toBeCloseTo(before!.width,1);expect(h).toBeCloseTo(before!.height,1)}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole("link",{name:/Récupérer mon pass/}).click();
  await expect(page).toHaveURL(/recuperer-mon-pass$/);
  await expect(page.getByRole("link",{name:/Demander la récupération gratuite/})).toHaveAttribute("href",/^mailto:.*R%C3%A9cup%C3%A9ration/);
  await expect(page.getByText(/La demande n’active pas automatiquement le pass/)).toBeVisible();
 });
}
test("homepage matches the approved desktop proportions and contains no invented staff",async({page})=>{
 await page.setViewportSize({width:1086,height:1448});await page.goto("/");
 const hero=await page.locator(".vitrail-hero").boundingBox();expect(hero!.height).toBeCloseTo(708,0);
 await expect(page.locator(".vitrail-home")).toHaveScreenshot("vitrail-approved-home-1086.png");
 await page.goto("/equipe");await expect(page.getByText("Frère Jean Emmanuel",{exact:true})).toHaveCount(0);
 await expect(page.getByRole("img",{name:"Théo Lafont"})).toBeVisible();
});
for(const path of ["/equipe","/contact","/mentions-legales","/cgv","/politique-confidentialite","/bibliotheque-apologetique","/recuperer-mon-pass","/auth/signup","/auth/password-forgot"]){
test(`secondary public page ${path} retains the illustrated identity and accessible headings`,async({page})=>{
 await page.setViewportSize({width:390,height:844});
  await page.goto(path);await expect(page.locator("main h1")).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator(".apostolos-brand img").first()).toHaveAttribute("src",/vitrail/);
  const audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();expect(audit.violations, path).toEqual([]);
  await expect(page).toHaveScreenshot(`vitrail-public-${path.replaceAll('/','-')}-mobile.png`);
});
}

