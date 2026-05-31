import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildMarketingEmail,
  campaignTemplates,
  resolveCampaignDate,
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

test("weekly marketing resolves mobile liturgical dates for 2026", () => {
  expect(resolveCampaignDate(campaignTemplates.find(template => template.key === "paques")!, 2026).toISOString()).toStartWith("2026-04-05");
  expect(resolveCampaignDate(campaignTemplates.find(template => template.key === "divine-misericorde")!, 2026).toISOString()).toStartWith("2026-04-12");
  expect(resolveCampaignDate(campaignTemplates.find(template => template.key === "pentecote")!, 2026).toISOString()).toStartWith("2026-05-24");
  expect(resolveCampaignDate(campaignTemplates.find(template => template.key === "avent")!, 2026).toISOString()).toStartWith("2026-11-29");
  expect(resolveCampaignDate(campaignTemplates.find(template => template.key === "christ-roi")!, 2026).toISOString()).toStartWith("2026-11-22");
});

test("weekly marketing selects Pentecost near May 24 in 2026", () => {
  expect(selectCampaignTemplate(new Date("2026-05-24T08:00:00.000Z")).key).toBe("pentecote");
});

test("weekly marketing personalizes a direct-response email with repeated CTAs and unsubscribe", () => {
  const email = buildMarketingEmail(profile, new Date("2026-06-28T08:00:00.000Z"), "https://irenee-institut.org/");

  expect(email.subject).toContain("Jean");
  expect(email.subject.length).toBeLessThanOrEqual(60);
  expect(email.body).toContain("https://irenee-institut.org/formations");
  expect(email.body).toContain("https://irenee-institut.org/desabonnement?token=unsubscribe-token");
  expect(email.body).toContain("Ne laissez pas passer une nouvelle semaine");
  expect(email.htmlBody.match(/Voir les formations/g)?.length).toBeGreaterThanOrEqual(3);
  expect(email.htmlBody).toContain("Ne remettez pas votre formation à plus tard");
  expect(email.htmlBody).toContain("Vous allez pouvoir");
  expect(email.htmlBody).toContain("P.S.");
  expect(email.htmlBody).toContain("https://irenee-institut.org/desabonnement?token=unsubscribe-token");
});

test("weekly marketing HTML uses the site identity and an email-compatible responsive layout", () => {
  const email = buildMarketingEmail(profile, new Date("2026-06-28T08:00:00.000Z"), "https://irenee-institut.org/");

  expect(email.htmlBody).toContain("https://irenee-institut.org/images/logo_with_text.png");
  expect(email.htmlBody).toContain('<meta charset="utf-8">');
  expect(email.htmlBody).toContain('role="presentation"');
  expect(email.htmlBody).toContain("@media screen and (max-width: 640px)");
  expect(email.htmlBody).toContain("#071d49");
  expect(email.htmlBody).toContain("#e5bd34");
  expect(email.htmlBody).toContain('alt="Institut d&#039;Apologétique Saint Irénée"');
});

test("weekly marketing subjects remain concise after personalization", () => {
  for (const template of campaignTemplates) {
    expect(template.subject.replace("{{prenom}}", "Alexandre").length).toBeLessThanOrEqual(60);
    expect(template.hook.length).toBeGreaterThan(30);
    expect(template.stakes.length).toBeGreaterThan(50);
    expect(template.urgency.length).toBeGreaterThan(40);
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
