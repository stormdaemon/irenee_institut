import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function publicAsset(path: string) {
  return readFileSync(join(root, "public", path));
}

function assetSize(path: string) {
  return publicAsset(path).length;
}

function assertWebpAsset(path: string, maxBytes: number) {
  const image = publicAsset(path);
  assert.equal(image.subarray(0, 4).toString("utf8"), "RIFF");
  assert.equal(image.subarray(8, 12).toString("utf8"), "WEBP");
  assert.ok(image.length <= maxBytes, `${path} is ${image.length} bytes`);
}

function assertAvifAsset(path: string, maxBytes: number) {
  const image = publicAsset(path);
  assert.equal(image.subarray(4, 8).toString("utf8"), "ftyp");
  assert.ok(["avif", "avis"].includes(image.subarray(8, 12).toString("utf8")));
  assert.ok(image.length <= maxBytes, `${path} is ${image.length} bytes`);
}

function cssRule(styles: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || "";
}
function pngDimensions(path: string) {
  const image = publicAsset(path);
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20)
  };
}

test("stained-glass homepage assets are valid WebP files within delivery budgets", () => {
 for (const name of ["hero", "return-band", "apologetique", "ecriture", "philosophie", "journal"]) {
  assertWebpAsset(`images/apostolos/vitrail/${name}.webp`, 600_000);
 }
 for (const name of ["emblem", "button", "frame", "texture"]) {
  assertWebpAsset(`images/apostolos/vitrail/${name}.webp`, 150_000);
 }
});
test("public navigation exposes its state and supports closing with Escape", () => {
 const header=source("components/Header.tsx");
 assert.match(header,/aria-expanded=\{open\}/);
 assert.match(header,/aria-controls="apostolos-mobile-nav"/);
 assert.match(header,/e.key==="Escape"/);
 assert.match(header,/aria-current=/);
});
test("Apostolos defers onboarding without unsolicited floating distractions", () => {
 const layout=source("app/layout.tsx"),chrome=source("components/DeferredClientChrome.tsx");
 assert.match(layout,/DeferredClientChrome/);
 assert.match(chrome,/dynamic\(/);
 assert.match(chrome,/OnboardingGate/);
 for(const source of [layout,chrome]) assert.doesNotMatch(source,/FloatingNetworkMenu|DonationPrompt|RadioPlayer/);
});
test("Apostolos provides narrow-screen layouts and respects reduced motion", () => {
 const css=source("app/apostolos.css");
 assert.match(css,/@media/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/apostolos-mobile-nav/);
 assert.match(css,/grid-template-columns:1fr/);
});

test("contact page cards collapse without horizontal overflow on narrow mobiles", () => {
  const contactPage = source("app/contact/page.tsx");
  const styles = source("app/globals.css");

  assert.match(contactPage, /className="section contact-section"/);
  assert.match(contactPage, /className="soft-card contact-form-card"/);
  assert.match(contactPage, /className="contact-details"/);
  assert.match(contactPage, /className="soft-card contact-info-card"/);
  assert.match(styles, /\.contact-section \.grid-2,[\s\S]*\{[^}]*min-width:\s*0/);
  assert.match(styles, /@media \(max-width: 900px\)\s*\{[^}]*\.contact-section \.grid-2\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/s);
  assert.match(styles, /@media \(max-width: 520px\)\s*\{[^}]*\.contact-form-card,\s*\.contact-info-card\s*\{[^}]*padding:\s*20px\s*!important/s);
});
test("team page lists Vivien Hoch with the requested theological specialties", () => {
  const teamPage = source("app/equipe/page.tsx");

  assert.match(teamPage, /Vivien Hoch/);
  assert.match(teamPage, /philosophie/i);
  assert.match(teamPage, /vocabulaire théologique/i);
  assert.match(teamPage, /nature, substance et personne/i);
  assert.match(teamPage, /\/images\/vivien-hoch\.jpg/);

  const photo = publicAsset("images/vivien-hoch.jpg");
  assert.equal(photo[0], 0xff);
  assert.equal(photo[1], 0xd8);
});

test("team member cards can shrink without horizontal mobile overflow", () => {
  const teamPage = source("app/equipe/page.tsx");
  const styles = source("app/globals.css");

  assert.match(teamPage, /className="card team-member-card"/);
  assert.match(styles, /\.team-member-card\s*\{[^}]*min-width:\s*0/);
  assert.match(styles, /\.team-member-card :is\(h2, p, strong, a\)\s*\{[^}]*overflow-wrap:\s*anywhere/);
});
test("public planning cards link to the protected live route", () => {
  const component = source("components/UpcomingSessions.tsx");
  const styles = source("app/globals.css");

  assert.match(component, /href=\{`\/direct\/\$\{session.liveSessionId\}`\}/);
  assert.match(component, /Participer/);
  assert.doesNotMatch(component, /daily\.co|daily_room_url/);
  assert.match(styles, /\.visio-participate\s*\{/);
});

test("legacy radio asset remains available but is absent from Apostolos navigation", () => {
  assert.match(source("components/RadioPlayer.tsx"), /https:\/\/play\.radioking\.io\/heavenradio\/731077/);
  assert.doesNotMatch(source("app/layout.tsx"), /<RadioPlayer \/>/);
});

test("fixed chrome keeps the radio player dark and the desktop network rail below it", () => {
  const styles = source("app/globals.css");
  assert.match(styles, /--radio-bar-height:\s*44px/);
  assert.match(styles, /\.radio-bar\s*\{[^}]*height:\s*var\(--radio-bar-height\)[^}]*linear-gradient\(180deg,\s*#071724 0%,\s*#03111f 100%\)/);
  assert.match(styles, /\.floating-network\s*\{[^}]*top:\s*calc\(132px \+ var\(--radio-bar-height\)\)/);
});

test("module iframe discards authored style blocks before applying its controlled reader theme", () => {
  const modulePage = source("app/cours/[slug]/modules/[moduleId]/page.tsx");
  assert.match(modulePage, /const moduleFrameThemeCss = `/);
  assert.doesNotMatch(modulePage, /<style>\$\{sanitizedCss\}<\/style>/);
  assert.match(modulePage, /stripAuthoredStyleBlocksBeforeParsing\(html\)/);
  assert.match(modulePage, /FORBID_TAGS:\s*\[/);
  assert.match(modulePage, /"style"/);
  assert.match(modulePage, /querySelectorAll<HTMLElement>\("\[style\]"\)[\s\S]*element\.removeAttribute\("style"\)/);
  assert.match(modulePage, /\.module-content,\s*\.module-content \*,\s*body > \* \{ color: #d9deeb !important;/);
  assert.match(modulePage, /\.module-content :is\(\.definition-box, \.quote-box, \.biblical-quote, \.note-box, \.warning-box, \.success-box, \.example-box\)/);
  assert.doesNotMatch(modulePage, /const normalizedHtml = html\.replace\(/);
  assert.match(modulePage, /DOMPurify\.sanitize\(stripAuthoredStyleBlocksBeforeParsing\(html\), \{/);
  assert.match(modulePage, /querySelector<HTMLElement>\("script\[nonce\], style\[nonce\]"\)\?\.nonce/);
  assert.equal((modulePage.match(/<style nonce="\$\{styleNonce\}">/g) || []).length, 3);
  assert.match(modulePage, /querySelectorAll<HTMLElement>\("\.comparison-table:not\(table\)"\)/);
});

test("admin rich editor controls authored text color through the active theme", () => {
  const css = source("app/globals.css");
  assert.match(css, /\.admin-shell \.rich-editor \.rich-canvas,\s*\.admin-shell \.rich-editor \.rich-canvas \*/);
  assert.match(css, /-webkit-text-fill-color: var\(--editor-text-fill, #172033\) !important;/);
  assert.match(css, /caret-color: #071d49;/);
});

test("admin role gates let formateurs use pedagogical tools while keeping direction sections restricted", () => {
  assert.match(source("app/admin/layout.tsx"), /requireAdminPage\(\)/);
  assert.match(source("app/admin/page.tsx"), /profile\.role === "directeur"/);
  assert.match(source("app/admin/users/layout.tsx"), /requireDirectorPage\("\/admin\/users"\)/);
  assert.match(source("app/admin/settings/layout.tsx"), /requireDirectorPage\("\/admin\/settings"\)/);
  assert.match(source("app/api/admin/live/route.ts"), /\["directeur", "formateur"\]/);
  assert.match(source("app/api/courses/route.ts"), /\["directeur", "formateur"\]/);
  assert.match(source("app/api/homework/route.ts"), /\["directeur", "formateur"\]/);
});

test("admin server pages scope formateur courses and homework to owned courses", () => {
  const dashboard = source("app/admin/page.tsx");
  const homeworkPage = source("app/admin/homework/page.tsx");
  const serverData = source("lib/server-data.ts");

  assert.match(serverData, /getHomework\(options: \{ authorId\?: string; courseIds\?: string\[\] \} = \{\}\)/);
  assert.match(serverData, /options\.courseIds && options\.courseIds\.length === 0/);
  assert.ok(serverData.includes("t.auteur_id=$1"));
  assert.ok(serverData.includes("t.course_id=any($2)"));

  assert.match(dashboard, /getCourses\("admin", isDirector \? \{\} : \{ authorId: profile\.id \}\)/);
  assert.match(dashboard, /getHomework\(isDirector \? \{\} : \{ authorId: profile\.id, courseIds: courses\.map\(course => course\.id\) \}\)/);

  assert.match(homeworkPage, /requireAdminPage\(\)/);
  assert.match(homeworkPage, /profile\.role === "directeur"/);
  assert.match(homeworkPage, /getCourses\("admin", \{ authorId: profile\.id \}\)/);
  assert.match(homeworkPage, /getHomework\(isDirector \? \{\} : \{ authorId: profile\.id, courseIds: courses\.map\(course => course\.id\) \}\)/);
});

test("SEO surfaces keep the established canonical page while adding the no-apostrophe school query", () => {
  const seo = source("lib/seo.ts");
  const schoolPage = source("app/ecole-apologetique-en-ligne/page.tsx");
  assert.match(seo, /L'Institut Apostolos Saint Irénée propose des formations catholiques structurées/);
  assert.match(schoolPage, /canonical: "\/ecole-apologetique-en-ligne"/);
  assert.match(schoolPage, /école apologétique catholique/);
});

test("clean annual pass signup URL stays private and preserves the checkout flow", () => {
  const routes = source("lib/routes.ts");
  const nextConfig = source("next.config.ts");
  const cleanSignupPage = source("app/inscription/page.tsx");
  const proxy = source("proxy.ts");
  const signupPage = source("app/auth/signup/page.tsx");
  const userMenu = source("components/UserMenu.tsx");
  const buyButton = source("components/BuyCourseButton.tsx");
  const loginPage = source("app/auth/login/page.tsx");

  assert.match(routes, /annualPassCheckoutPath = "\/formations\?checkout=annual-pass"/);
  assert.match(routes, /cleanAnnualPassSignupPath = "\/inscription"/);
  assert.match(nextConfig, /source: cleanAnnualPassSignupPath/);
  assert.match(nextConfig, /X-Robots-Tag/);
  assert.match(nextConfig, /noindex, nofollow, noarchive/);
  assert.match(cleanSignupPage, /import SignupPage from "@\/app\/auth\/signup\/page"/);
  assert.match(cleanSignupPage, /metadata = privatePageMetadata/);
  assert.match(proxy, /export function proxy\(request: NextRequest\)/);
  assert.match(proxy, /request\.nextUrl\.searchParams\.get\("next"\) === annualPassCheckoutPath/);
  assert.match(proxy, /emptyRedirect\(url, 307\)/);
  assert.match(signupPage, /window\.location\.pathname === cleanAnnualPassSignupPath/);
  assert.match(userMenu, /const annualPassSignupHref = cleanAnnualPassSignupPath/);
  assert.match(buyButton, /window\.location\.href = cleanAnnualPassSignupPath/);
  assert.match(loginPage, /next === annualPassCheckoutPath/);
});

test("library migration activates memberships only for an exact 15 euro capture", () => {
  const migration = source("supabase/migrations/20260601020000_library_memberships.sql");
  assert.match(migration, /create table if not exists public\.library_memberships/);
  assert.match(migration, /v_product_type = 'library_membership' and coalesce\(p_amount_total, 0\) <> 1500/);
  assert.match(migration, /revoke execute on function public\.validate_paypal_payment/);
});
