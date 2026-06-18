import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
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

test("SEO surfaces keep the established canonical page while adding the no-apostrophe school query", () => {
  const seo = source("lib/seo.ts");
  const schoolPage = source("app/ecole-apologetique-en-ligne/page.tsx");
  assert.match(seo, /L'institut d'Apologétique Saint Irénée propose des formations catholiques structurées/);
  assert.match(schoolPage, /canonical: "\/ecole-apologetique-en-ligne"/);
  assert.match(schoolPage, /école apologétique catholique/);
});

test("library migration activates memberships only for an exact 15 euro capture", () => {
  const migration = source("supabase/migrations/20260601020000_library_memberships.sql");
  assert.match(migration, /create table if not exists public\.library_memberships/);
  assert.match(migration, /v_product_type = 'library_membership' and coalesce\(p_amount_total, 0\) <> 1500/);
  assert.match(migration, /revoke execute on function public\.validate_paypal_payment/);
});
