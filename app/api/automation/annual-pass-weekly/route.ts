import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { emailOptoutUrl } from "@/lib/email-optout";
import { annualPassCheckoutPath } from "@/lib/routes";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

const CAMPAIGN_PREFIX = "annual-pass-weekly-";
const SITE_URL = "https://irenee-institut.org";
const CHECKOUT_URL = `${SITE_URL}${annualPassCheckoutPath}`;
const LOGO_URL = `${SITE_URL}/images/logo_with_text.png`;

type WeeklyRow = {
  delivery_id: string;
  email: string;
  nom?: string | null;
  prenom?: string | null;
  profile_id: string;
};

type WeeklyTheme = {
  eyebrow: string;
  title: string;
  hook: string;
  articleLabel: string;
  articleUrl: string;
  subject: string;
};

const themes: WeeklyTheme[] = [
  {
    eyebrow: "Le thème de la semaine",
    title: "La fiabilité des Évangiles",
    hook: "Manuscrits anciens, témoignages romains, archéologie : les Évangiles sont le texte antique le mieux attesté. Savoir le montrer calmement change toutes les conversations.",
    articleLabel: "Lire le dossier complet",
    articleUrl: `${SITE_URL}/blog/fiabilite-des-evangiles-dossier`,
    subject: "Peut-on faire confiance aux Évangiles ? Formez-vous à répondre"
  },
  {
    eyebrow: "Le thème de la semaine",
    title: "Foi et raison, deux lumières",
    hook: "« Je crois pour comprendre, je comprends pour croire. » La tradition catholique n'a jamais opposé l'intelligence et la foi — apprenez à le montrer.",
    articleLabel: "Lire l'article",
    articleUrl: `${SITE_URL}/blog/foi-et-raison-deux-lumieres`,
    subject: "Foi et raison : et si vous appreniez à en rendre compte ?"
  },
  {
    eyebrow: "Le thème de la semaine",
    title: "Le problème du mal",
    hook: "C'est l'objection la plus fréquente et la plus sensible. Y répondre sans durcir le cœur demande une vraie formation — pas des formules toutes faites.",
    articleLabel: "Lire l'article",
    articleUrl: `${SITE_URL}/blog/probleme-du-mal-repondre-sans-durcir-le-coeur`,
    subject: "Répondre au problème du mal sans durcir le cœur"
  },
  {
    eyebrow: "Le thème de la semaine",
    title: "Science et foi, sortir des caricatures",
    hook: "Un prêtre a formulé la théorie du Big Bang. L'opposition science-foi est une caricature moderne : les faits racontent une autre histoire.",
    articleLabel: "Lire l'article",
    articleUrl: `${SITE_URL}/blog/science-et-foi-sortir-des-caricatures`,
    subject: "Science et foi : ce que l'histoire dit vraiment"
  },
  {
    eyebrow: "Le thème de la semaine",
    title: "La Résurrection, cœur de la foi",
    hook: "Tombeau vide, témoins transformés, Église née en quelques années : le dossier historique de Pâques mérite mieux qu'un haussement d'épaules.",
    articleLabel: "Lire l'article",
    articleUrl: `${SITE_URL}/blog/resurrection-de-jesus-coeur-historique-foi`,
    subject: "La Résurrection : un dossier historique à connaître"
  },
  {
    eyebrow: "Le thème de la semaine",
    title: "Saint Irénée, docteur de l'unité",
    hook: "Face aux confusions de son temps, Irénée de Lyon répondait par les sources et la charité. C'est l'esprit de tout notre parcours de formation.",
    articleLabel: "Lire l'article",
    articleUrl: `${SITE_URL}/blog/saint-irenee-docteur-unite-foi-recue`,
    subject: "L'esprit de saint Irénée : répondre par les sources"
  }
];

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sameSecret(received: string, expected: string) {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function authenticate(request: Request, supabase: NonNullable<ReturnType<typeof createServerClient>>) {
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const settings = await getSystemSettings(supabase);
  const expected = String(settings.googleAppsScriptMailSecret || process.env.GOOGLE_APPS_SCRIPT_MAIL_SECRET || "").trim();
  return sameSecret(received, expected);
}

function recipientName(profile: Pick<WeeklyRow, "email" | "nom" | "prenom">) {
  return `${profile.prenom || ""}`.trim() || `${profile.nom || ""}`.trim() || "cher étudiant";
}

function weeklyHtml(profile: WeeklyRow, theme: WeeklyTheme) {
  const name = recipientName(profile);
  const optoutUrl = emailOptoutUrl(profile.profile_id);
  return `<!doctype html>
<html>
  <body style="margin:0;background:#04101e;padding:0;font-family:Arial,Helvetica,sans-serif;color:#f8f1df">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent">${escapeHtml(theme.hook)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#04101e;padding:28px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;border:1px solid rgba(220,180,107,.55);background:#071523;border-radius:8px;overflow:hidden">
            <tr>
              <td style="padding:26px 28px 18px;border-bottom:1px solid rgba(220,180,107,.28);background:linear-gradient(180deg,#071724,#03111f)">
                <img src="${LOGO_URL}" width="230" alt="Institut d'Apologétique Saint Irénée" style="display:block;width:230px;max-width:100%;height:auto;border:0;margin-bottom:20px">
                <div style="color:#f0cf8a;font-weight:700;text-transform:uppercase;font-size:12px;letter-spacing:.08em">${escapeHtml(theme.eyebrow)}</div>
                <h1 style="margin:8px 0 0;color:#fff7e7;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15">${escapeHtml(theme.title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#f0dfc2;font-size:16px;line-height:1.65">
                <p style="margin:0 0 16px">Bonjour ${escapeHtml(name)},</p>
                <p style="margin:0 0 16px">${escapeHtml(theme.hook)}</p>
                <p style="margin:0 0 22px"><a href="${theme.articleUrl}" style="color:#f0cf8a;text-decoration:underline">${escapeHtml(theme.articleLabel)} →</a></p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border:1px solid rgba(220,180,107,.4);border-radius:8px;background:rgba(220,180,107,.06)">
                  <tr>
                    <td style="padding:20px 22px;color:#f0dfc2">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#f1d27a;margin-bottom:8px">Allez plus loin avec le pass annuel</div>
                      <p style="margin:0 0 8px;font-size:15px;line-height:1.7">Ce thème, et tous les autres, sont approfondis dans le cursus complet de l'Institut : modules progressifs, espace étudiant, évaluations corrigées, examen final et certificat nominatif.</p>
                      <p style="margin:0;font-size:15px;line-height:1.7"><strong style="color:#fff7e7">365 jours d'accès, en participation libre</strong> (prix conseillé : 99&nbsp;€) — pour que la question financière n'écarte personne de l'étude.</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 8px">
                  <tr>
                    <td style="border-radius:6px;background:#dcb46b">
                      <a href="${CHECKOUT_URL}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#071523;text-decoration:none">Activer mon pass annuel</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;color:#d8c9ad;font-size:14px">Connectez-vous avec cette adresse email, puis laissez-vous guider : ${escapeHtml(CHECKOUT_URL)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;color:#b9ab8e;border-top:1px solid rgba(220,180,107,.22);font-size:12px;line-height:1.7">
                Vous recevez cet email car un compte existe à cette adresse sur irenee-institut.org.<br>
                <a href="${optoutUrl}" style="color:#d8c9ad;text-decoration:underline">Ne plus recevoir ces invitations</a>
                &nbsp;·&nbsp; Institut d'Apologétique Saint Irénée — ${SITE_URL}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildJob(row: WeeklyRow, campaignKey: string, theme: WeeklyTheme) {
  const name = recipientName(row);
  return {
    campaignKey,
    htmlBody: weeklyHtml(row, theme),
    jobId: row.delivery_id,
    profileId: row.profile_id,
    subject: theme.subject,
    textBody: [
      `Bonjour ${name},`,
      "",
      `${theme.title}. ${theme.hook}`,
      "",
      `${theme.articleLabel} : ${theme.articleUrl}`,
      "",
      "Pour aller plus loin, le pass annuel de l'Institut donne 365 jours d'accès au cursus complet d'apologétique, en participation libre (prix conseillé : 99 euros).",
      "",
      `Activer mon pass annuel : ${CHECKOUT_URL}`,
      "",
      `Ne plus recevoir ces invitations : ${emailOptoutUrl(row.profile_id)}`,
      "",
      "Institut d'Apologétique Saint Irénée"
    ].join("\n"),
    to: row.email
  };
}

export async function GET(request: Request) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });
  if (!await authenticate(request, supabase)) return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 401 });

  const week = await query<{ iso_week: string; week_number: number }>(
    `select
       to_char(now() at time zone 'Europe/Paris', 'IYYY-"W"IW') as iso_week,
       extract(week from now() at time zone 'Europe/Paris')::int as week_number`
  );
  const campaignKey = `${CAMPAIGN_PREFIX}${week.rows[0].iso_week}`;
  const theme = themes[week.rows[0].week_number % themes.length];

  await query(
    `with eligible as (
       select p.id
       from public.profiles p
       where p.role = 'etudiant'
         and nullif(btrim(p.email), '') is not null
         and split_part(lower(p.email), '@', 2) not in ('example.org', 'example.com', 'example.net', 'example.test')
         and split_part(lower(p.email), '@', 2) not like '%.test'
         and split_part(lower(p.email), '@', 2) not like '%.invalid'
         and split_part(lower(p.email), '@', 2) not like '%.localhost'
         and not exists (
           select 1 from public.marketing_email_optouts o where o.profile_id = p.id
         )
         and not exists (
           select 1
           from public.annual_access_passes pass
           where pass.user_id = p.id
             and pass.status = 'active'
             and pass.expires_at > now()
         )
     )
     insert into public.marketing_campaign_deliveries (profile_id, campaign_key, delivery_status, attempt_count, updated_at)
     select eligible.id, $1, 'pending', 0, now()
     from eligible
     on conflict (profile_id, campaign_key) do nothing`,
    [campaignKey]
  );

  const result = await query<WeeklyRow>(
    `select
       d.id as delivery_id,
       p.id as profile_id,
       p.email,
       p.prenom,
       p.nom
     from public.marketing_campaign_deliveries d
     join public.profiles p on p.id = d.profile_id
     where d.campaign_key = $1
       and d.delivery_status <> 'sent'
       and d.attempt_count < 3
       and p.role = 'etudiant'
       and nullif(btrim(p.email), '') is not null
       and split_part(lower(p.email), '@', 2) not in ('example.org', 'example.com', 'example.net', 'example.test')
       and split_part(lower(p.email), '@', 2) not like '%.test'
       and split_part(lower(p.email), '@', 2) not like '%.invalid'
       and split_part(lower(p.email), '@', 2) not like '%.localhost'
       and not exists (
         select 1 from public.marketing_email_optouts o where o.profile_id = p.id
       )
       and not exists (
         select 1
         from public.annual_access_passes pass
         where pass.user_id = p.id
           and pass.status = 'active'
           and pass.expires_at > now()
       )
     order by p.created_at desc
     limit 40`,
    [campaignKey]
  );

  return NextResponse.json({ ok: true, jobs: result.rows.map(row => buildJob(row, campaignKey, theme)) });
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });
  if (!await authenticate(request, supabase)) return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const jobId = String(body.jobId || "").trim();
  const profileId = String(body.profileId || "").trim();
  if (!jobId || !profileId) return NextResponse.json({ ok: false, error: "jobId et profileId requis." }, { status: 400 });

  const sent = body.ok === true;
  const result = await query<{ id: string; delivery_status: string }>(
    `update public.marketing_campaign_deliveries
     set
       attempt_count = attempt_count + 1,
       delivery_status = case when $3::boolean then 'sent' else 'failed' end,
       sent_at = case when $3::boolean then now() else sent_at end,
       last_error = case when $3::boolean then null else $4::text end,
       updated_at = now()
     where id = $1
       and profile_id = $2
       and campaign_key like $5
     returning id, delivery_status`,
    [jobId, profileId, sent, String(body.error || "Envoi Google Apps Script impossible."), `${CAMPAIGN_PREFIX}%`]
  );

  const row = result.rows[0];
  if (!row) return NextResponse.json({ ok: false, error: "Invitation introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true, data: row });
}
