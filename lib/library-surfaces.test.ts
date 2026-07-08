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

test("module iframe applies its night theme after the saved lesson styles", () => {
  const modulePage = source("app/cours/[slug]/modules/[moduleId]/page.tsx");
  assert.match(modulePage, /const moduleFrameThemeCss = `/);
  assert.match(modulePage, /<style>\$\{sanitizedCss\}<\/style>\s*<style>\$\{moduleFrameThemeCss\}<\/style>/);
  assert.match(modulePage, /\.module-content,\s*\.module-content \*,\s*body > \* \{ color: #172033 !important;/);
  assert.match(modulePage, /\.module-content :is\(\.definition-box, \.quote-box, \.biblical-quote, \.note-box, \.warning-box, \.success-box, \.example-box\)/);
  assert.match(modulePage, /const normalizedHtml = html\.replace\(/);
  assert.match(modulePage, /DOMPurify\.sanitize\(normalizedHtml\)/);
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
