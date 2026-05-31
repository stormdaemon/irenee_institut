import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildMarketingEmail,
  campaignTemplates,
  selectCampaignTemplate
} from "../supabase/functions/send-weekly-marketing/weekly-marketing";

const profile = {
  id: "profile-id",
  email: "jean@example.com",
  prenom: "Jean",
  nom: "Dupont",
  marketing_unsubscribe_token: "unsubscribe-token",
  course_enrollments: []
};

test("weekly marketing prepares at least twenty Catholic calendar campaigns", () => {
  expect(campaignTemplates.length).toBeGreaterThanOrEqual(20);
});

test("weekly marketing selects Saint Irenaeus near June 28", () => {
  expect(selectCampaignTemplate(new Date("2026-06-28T08:00:00.000Z")).key).toBe("saint-irenee");
});

test("weekly marketing personalizes the email with one CTA and an unsubscribe link", () => {
  const email = buildMarketingEmail(profile, new Date("2026-06-28T08:00:00.000Z"), "https://irenee-institut.org/");

  expect(email.subject).toContain("Jean");
  expect(email.subject.length).toBeLessThanOrEqual(60);
  expect(email.body).toContain("https://irenee-institut.org/formations");
  expect(email.body).toContain("https://irenee-institut.org/desabonnement?token=unsubscribe-token");
  expect(email.htmlBody.match(/Découvrir les formations/g)?.length).toBe(1);
});

test("weekly marketing subjects remain concise after personalization", () => {
  for (const template of campaignTemplates) {
    expect(template.subject.replace("{{prenom}}", "Alexandre").length).toBeLessThanOrEqual(60);
  }
});

test("signup enables the weekly letter by default and unsubscribe requires confirmation", () => {
  const signup = readFileSync(new URL("../app/auth/signup/page.tsx", import.meta.url), "utf8");
  const unsubscribe = readFileSync(new URL("../app/desabonnement/route.ts", import.meta.url), "utf8");

  expect(signup).toContain('name="marketing_opt_in"');
  expect(signup).toContain('name="marketing_opt_in" type="checkbox" defaultChecked');
  expect(signup).toContain("Recevoir les actualités importantes, ressources et offres de formations de l'Institut Irénée");
  expect(unsubscribe).toContain("Confirmer le désabonnement");
  expect(unsubscribe).toContain("export async function POST");
});
