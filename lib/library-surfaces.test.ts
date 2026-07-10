import test from "node:test";
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

test("homepage exposes the EIDM, library, live training and patristic session feature cards", () => {
  const homepage = source("app/page.tsx");
  assert.match(homepage, /L'EIDM devient l'Institut Saint Irénée/);
  assert.match(homepage, /Bibliothèque d'école apologétique/);
  assert.match(homepage, /Formation en direct chaque semaine/);
  assert.match(homepage, /Sessions patristiques en abbaye/);
  assert.match(homepage, /Rentrée académique 2026/);
  assert.match(homepage, /https:\/\/youtu\.be\/AsclUFsCoAM\?is=Vxx2XTJ5DOkgPGh9/);
  assert.doesNotMatch(homepage, /hero-cross/);
});

test("homepage uses the requested e-learning logo asset", () => {
  const homepage = source("app/page.tsx");

  assert.match(homepage, /src="\/images\/logo-elearning\.png"/);
  assert.deepEqual(pngDimensions("images/logo-elearning.png"), { width: 1754, height: 861 });
});

test("homepage exposes Samy's presentation video in the hero without forcing autoplay", () => {
  const homepage = source("app/page.tsx");

  assert.match(homepage, /presentationVideoPath = "\/videos\/presentation-institut-saint-irenee-samy\.mp4"/);
  assert.match(homepage, /className="hero-video-disclosure"/);
  assert.match(homepage, /className="hero-video-toggle"/);
  assert.match(homepage, /@type": "VideoObject"/);
  assert.match(homepage, /<JsonLd data=\{presentationVideoJsonLd\} \/>/);
  assert.match(homepage, /<video[\s\S]*controls[\s\S]*preload="none"[\s\S]*playsInline/);
  assert.doesNotMatch(homepage, /autoPlay/);
});

test("presentation video asset is available as the uploaded MP4", () => {
  const video = publicAsset("videos/presentation-institut-saint-irenee-samy.mp4");

  assert.equal(video.subarray(4, 8).toString("utf8"), "ftyp");
  assert.ok(video.length > 60_000_000);
});

test("hero proof points read as editorial text instead of button-like pills", () => {
  const homepage = source("app/page.tsx");
  const styles = source("app/globals.css");
  const proofPointRule = cssRule(styles, ".hero-proof-points span");

  assert.match(homepage, /Formation hebdomadaire en visio sur cette plateforme à partir de septembre 2026/);
  assert.doesNotMatch(homepage, /Rencontres en direct à partir de décembre 2026/);
  assert.match(proofPointRule, /background:\s*transparent/);
  assert.match(proofPointRule, /border:\s*0/);
  assert.match(proofPointRule, /border-radius:\s*0/);
  assert.match(proofPointRule, /box-shadow:\s*none/);
  assert.doesNotMatch(proofPointRule, /cursor:\s*pointer/);
  assert.match(styles, /\.hero-proof-points span::before\s*\{[^}]*content:\s*""/);
});

test("homepage uses optimized WebP assets for heavy visual backgrounds", () => {
  const homepage = source("app/page.tsx");
  const styles = source("app/globals.css");
  const onboarding = source("components/OnboardingGate.tsx");

  for (const asset of [
    "eidm-institut-saint-irenee",
    "irenee-feature-1",
    "irenee-feature-3",
    "cloitre-sessions-patristiques"
  ]) {
    assert.match(homepage, new RegExp(`/images/${asset}\\.webp`));
    assert.match(onboarding, new RegExp(`/images/${asset}\\.webp`));
  }

  assert.match(styles, /url\("\/images\/irenee-hero-cathedral\.webp"\)/);
  assert.match(styles, /url\("\/images\/irenee-parchment-quote-clean\.webp"\)/);
  assert.match(onboarding, /\/images\/irenee-hero-cathedral\.webp/);
  assert.match(onboarding, /\/images\/irenee-parchment-quote-clean\.webp/);

  assertWebpAsset("images/irenee-hero-cathedral.webp", 420_000);
  assertWebpAsset("images/eidm-institut-saint-irenee.webp", 320_000);
  assertWebpAsset("images/cloitre-sessions-patristiques.webp", 360_000);
  assertWebpAsset("images/irenee-parchment-quote-clean.webp", 360_000);
  assertWebpAsset("images/irenee-feature-1.webp", 170_000);
  assertWebpAsset("images/irenee-feature-3.webp", 170_000);

  assert.ok(assetSize("images/irenee-hero-cathedral.webp") < assetSize("images/irenee-hero-cathedral.png"));
  assert.ok(assetSize("images/irenee-parchment-quote-clean.webp") < assetSize("images/irenee-parchment-quote-clean.png"));
});

test("homepage prioritizes responsive AVIF backgrounds for mobile performance", () => {
  const homepage = source("app/page.tsx");
  const styles = source("app/globals.css");

  for (const asset of [
    "eidm-institut-saint-irenee",
    "irenee-feature-1",
    "irenee-feature-3",
    "cloitre-sessions-patristiques"
  ]) {
    assert.match(homepage, new RegExp(`/images/${asset}\\.avif`));
    assert.match(homepage, new RegExp(`/images/${asset}\\.webp`));
  }

  assert.match(homepage, /rel="preload"[\s\S]*\/images\/irenee-hero-cathedral-mobile\.avif[\s\S]*media="\(max-width: 700px\)"[\s\S]*fetchPriority="high"/);
  assert.match(homepage, /rel="preload"[\s\S]*\/images\/irenee-hero-cathedral\.avif[\s\S]*media="\(min-width: 701px\)"[\s\S]*fetchPriority="high"/);

  assert.match(styles, /\.home-hero\s*\{[^}]*image-set\([^}]*irenee-hero-cathedral\.avif[^}]*irenee-hero-cathedral\.webp/s);
  assert.match(styles, /@media \(max-width: 700px\)\s*\{[^}]*\.home-hero\s*\{[^}]*image-set\([^}]*irenee-hero-cathedral-mobile\.avif[^}]*irenee-hero-cathedral-mobile\.webp/s);
  assert.match(styles, /\.quote-banner\s*\{[^}]*image-set\([^}]*irenee-parchment-quote-clean\.avif[^}]*irenee-parchment-quote-clean\.webp/s);
  assert.match(styles, /\.page-hero,\s*\.hero-band:not\(\.home-hero\)\s*\{/);
  assert.match(styles, /\.page-hero,\s*\.hero-band:not\(\.home-hero\)\s*\{[^}]*image-set\([^}]*irenee-hero-cathedral\.avif[^}]*irenee-hero-cathedral\.webp/s);
  assert.match(styles, /\.footer\s*\{[^}]*image-set\([^}]*irenee-hero-cathedral\.avif[^}]*irenee-hero-cathedral\.webp/s);
  assert.doesNotMatch(styles, /\.page-hero,\s*\.hero-band\s*\{[^}]*irenee-hero-cathedral\.webp/s);

  assertAvifAsset("images/irenee-hero-cathedral.avif", 120_000);
  assertAvifAsset("images/irenee-hero-cathedral-mobile.avif", 80_000);
  assertAvifAsset("images/eidm-institut-saint-irenee.avif", 42_000);
  assertAvifAsset("images/cloitre-sessions-patristiques.avif", 115_000);
  assertAvifAsset("images/irenee-parchment-quote-clean.avif", 80_000);
  assertAvifAsset("images/irenee-feature-1.avif", 22_000);
  assertAvifAsset("images/irenee-feature-3.avif", 26_000);
  assertWebpAsset("images/irenee-hero-cathedral-mobile.webp", 120_000);

  assert.ok(assetSize("images/irenee-hero-cathedral.avif") < assetSize("images/irenee-hero-cathedral.webp"));
  assert.ok(assetSize("images/irenee-hero-cathedral-mobile.avif") < assetSize("images/irenee-hero-cathedral.webp"));
  assert.ok(assetSize("images/cloitre-sessions-patristiques.avif") < assetSize("images/cloitre-sessions-patristiques.webp"));
  assert.ok(assetSize("images/irenee-parchment-quote-clean.avif") < assetSize("images/irenee-parchment-quote-clean.webp"));
});

test("public homepage chrome avoids unnecessary anonymous network work", () => {
  const homepage = source("app/page.tsx");
  const header = source("components/Header.tsx");
  const userMenu = source("components/UserMenu.tsx");

  const publicHomeLinks = homepage
    .match(/<Link\b[^>]*href="\/(?!\/)[^"]*"[^>]*>/g) || [];
  const headerLinks = header.match(/<Link\b[^>]*>/g) || [];

  assert.ok(publicHomeLinks.length > 0);
  assert.ok(headerLinks.length > 0);
  for (const link of [...publicHomeLinks, ...headerLinks]) {
    assert.match(link, /prefetch=\{false\}/, link);
  }

  assert.doesNotMatch(userMenu, /if \(error \|\| !data\.user\)\s*\{\s*await \w+\(\)/);
  assert.match(userMenu, /if \(!data\.user\)\s*\{\s*setProfile\(null\);\s*return;\s*\}/);
});

test("layout defers non-critical floating and onboarding chrome on public pages", () => {
  const layout = source("app/layout.tsx");
  const deferredChrome = source("components/DeferredClientChrome.tsx");

  assert.match(layout, /import \{ DeferredClientChrome \} from "@\/components\/DeferredClientChrome"/);
  assert.doesNotMatch(layout, /import \{ FloatingNetworkMenu \}/);
  assert.doesNotMatch(layout, /import \{ DonationPrompt \}/);
  assert.doesNotMatch(layout, /import \{ OnboardingGate \}/);
  assert.match(deferredChrome, /"use client"/);
  assert.match(deferredChrome, /dynamic\([\s\S]*import\("@\/components\/FloatingNetworkMenu"\)/);
  assert.match(deferredChrome, /dynamic\([\s\S]*import\("@\/components\/DonationPrompt"\)/);
  assert.match(deferredChrome, /dynamic\([\s\S]*import\("@\/components\/OnboardingGate"\)/);
  assert.match(deferredChrome, /const publicChromeDelayMs = 7000/);
  assert.match(deferredChrome, /pointerdown/);
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
test("planning cards expose the participation CTA only for connected student profiles", () => {
  const component = source("components/UpcomingSessions.tsx");
  const styles = source("app/globals.css");

  assert.match(component, /useConnectedStudent/);
  assert.match(component, /\.select\("role"\)/);
  assert.match(component, /\(profile\?\.role \|\| "etudiant"\) === "etudiant"/);
  assert.match(component, /isConnectedStudent && \(/);
  assert.match(component, /Je participe/);
  assert.match(component, /href="\/espace-etudiant"/);
  assert.match(styles, /\.visio-participate\s*\{/);
});

test("fixed Heaven Radio player uses the requested RadioKing stream", () => {
  assert.match(source("components/RadioPlayer.tsx"), /https:\/\/play\.radioking\.io\/heavenradio\/731077/);
  assert.match(source("app/layout.tsx"), /<RadioPlayer \/>/);
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
  assert.match(modulePage, /FORBID_TAGS:\s*\[/);
  assert.match(modulePage, /"style"/);
  assert.match(modulePage, /querySelectorAll<HTMLElement>\("\[style\]"\)[\s\S]*element\.removeAttribute\("style"\)/);
  assert.match(modulePage, /\.module-content,\s*\.module-content \*,\s*body > \* \{ color: #172033 !important;/);
  assert.match(modulePage, /\.module-content :is\(\.definition-box, \.quote-box, \.biblical-quote, \.note-box, \.warning-box, \.success-box, \.example-box\)/);
  assert.match(modulePage, /const normalizedHtml = html\.replace\(/);
  assert.match(modulePage, /DOMPurify\.sanitize\(normalizedHtml, \{/);
  assert.match(modulePage, /querySelectorAll<HTMLElement>\("\.comparison-table:not\(table\)"\)/);
});

test("admin rich editor keeps saved light text readable while editing", () => {
  const css = source("app/globals.css");
  assert.match(css, /\.admin-shell \.rich-editor \.rich-canvas,\s*\.admin-shell \.rich-editor \.rich-canvas \*/);
  assert.match(css, /-webkit-text-fill-color: #172033 !important;/);
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
  assert.match(serverData, /\.eq\("auteur_id", options\.authorId\)/);
  assert.match(serverData, /\.in\("course_id", options\.courseIds\)/);

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
  assert.match(seo, /L'Institut Saint Irénée propose des formations catholiques structurées/);
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
  assert.match(proxy, /NextResponse\.redirect\(url, 307\)/);
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
