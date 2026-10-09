import { siteUrl } from "@/lib/seo";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { annualPassCheckoutPath, cleanAnnualPassSignupPath } from "@/lib/routes";
import { getSystemSettings } from "@/lib/settings";
import { createServerContext } from "@/lib/postgres";

export const runtime = "nodejs";

const CAMPAIGN_KEY = "annual-pass-account-reminder-2026-09";
const SITE_URL = siteUrl;
const SIGNUP_URL = `${SITE_URL}${cleanAnnualPassSignupPath}`;
const CHECKOUT_URL = `${SITE_URL}${annualPassCheckoutPath}`;
const LOGO_URL = `${SITE_URL}/images/apostolos/wordmark.png`;

type ReminderRow = {
  created_at?: string | null;
  delivery_id: string;
  email: string;
  nom?: string | null;
  prenom?: string | null;
  profile_id: string;
};

function escapeHtml(value: string) {
  return value
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

async function authenticate(request: Request, context: NonNullable<ReturnType<typeof createServerContext>>) {
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const settings = await getSystemSettings(context);
  const expected = String(settings.googleAppsScriptMailSecret || process.env.GOOGLE_APPS_SCRIPT_MAIL_SECRET || "").trim();
  return sameSecret(received, expected);
}

function recipientName(profile: Pick<ReminderRow, "email" | "nom" | "prenom">) {
  return `${profile.prenom || ""} ${profile.nom || ""}`.trim() || profile.email || "cher étudiant";
}

function reminderHtml(profile: ReminderRow) {
  const name = recipientName(profile);
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f7f6ee;padding:0;font-family:Arial,Helvetica,sans-serif;color:#193f34">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent">Un parcours structuré pour étudier à votre rythme.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f6ee;padding:28px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;border:1px solid rgba(220,180,107,.55);background:#ffffff;border-radius:8px;overflow:hidden">
            <tr>
              <td style="padding:26px 28px 18px;border-bottom:1px solid rgba(220,180,107,.28);background:linear-gradient(180deg,#f0eee4,#f7f6ee)">
                <img src="${LOGO_URL}" width="230" alt="Institut Apostolos Saint Irénée" style="display:block;width:230px;max-width:100%;height:auto;border:0;margin-bottom:20px">
                <div style="color:#8b422a;font-weight:700;text-transform:uppercase;font-size:12px;letter-spacing:.08em">Votre parcours Apostolos</div>
                <h1 style="margin:8px 0 0;color:#193f34;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.1">Activez votre pass annuel</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#35483f;font-size:16px;line-height:1.65">
                <p style="margin:0 0 16px">Bonjour ${escapeHtml(name)},</p>
                <p style="margin:0 0 16px">Votre inscription à l'Institut Apostolos Saint Irénée est bien enregistrée, mais aucun pass annuel actif n'est encore associé à votre compte.</p>
                <p style="margin:0 0 16px"><strong style="color:#193f34">Un parcours structuré pour étudier à votre rythme.</strong> Pour accéder au cursus, aux séances en direct et aux documents pédagogiques, activez votre compte pass annuel.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid rgba(220,180,107,.28);border-radius:8px;background:rgba(220,180,107,.06)">
                  <tr>
                    <td style="padding:16px;color:#35483f">Le pass annuel donne accès pendant 365 jours au cursus d'apologétique, à votre espace étudiant et aux validations de progression.</td>
                  </tr>
                </table>
                <p style="margin:0 0 12px"><a href="${SIGNUP_URL}" style="display:inline-block;background:#e5b78b;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:6px">Créer mon compte pass annuel</a></p>
                <p style="margin:0;color:#5c6961;font-size:14px">Si vous avez déjà un compte, connectez-vous avec cette adresse email puis choisissez le pass annuel : <a href="${CHECKOUT_URL}" style="color:#8b422a;text-decoration:none">${CHECKOUT_URL}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;color:#5c6961;border-top:1px solid rgba(220,180,107,.22);font-size:13px">
                Institut Apostolos Saint Irénée - ${SITE_URL}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildJob(row: ReminderRow) {
  const name = recipientName(row);
  return {
    campaignKey: CAMPAIGN_KEY,
    htmlBody: reminderHtml(row),
    jobId: row.delivery_id,
    profileId: row.profile_id,
    subject: "Activez votre pass annuel Institut Apostolos Saint Irénée",
    textBody: [
      `Bonjour ${name},`,
      "",
      "Votre inscription à l'Institut Apostolos Saint Irénée est bien enregistrée, mais aucun pass annuel actif n'est encore associé à votre compte.",
      "",
      "Un parcours structuré pour étudier à votre rythme.",
      "",
      "Pour accéder au cursus, aux séances en direct et aux documents pédagogiques, activez votre compte pass annuel :",
      SIGNUP_URL,
      "",
      "Si vous avez déjà un compte, connectez-vous avec cette adresse email puis choisissez le pass annuel :",
      CHECKOUT_URL,
      "",
      "Institut Apostolos Saint Irénée"
    ].join("\n"),
    to: row.email
  };
}

export async function GET(request: Request) {
  const context = createServerContext();
  if (!context) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });
  if (!await authenticate(request, context)) return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 401 });

  const url = new URL(request.url);
  const targetEmail = url.searchParams.get("email")?.trim().toLowerCase() || "";

  await query(
    `with eligible as (
       select p.id
       from public.profiles p
       where p.role = 'etudiant'
         and nullif(btrim(p.email), '') is not null
         and ($2::text = '' or lower(p.email) = $2)
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
    [CAMPAIGN_KEY, targetEmail]
  );

  const result = await query<ReminderRow>(
    `select
       d.id as delivery_id,
       p.id as profile_id,
       p.email,
       p.prenom,
       p.nom,
       p.created_at
     from public.marketing_campaign_deliveries d
     join public.profiles p on p.id = d.profile_id
     where d.campaign_key = $1
       and d.delivery_status <> 'sent'
       and d.attempt_count < 3
       and p.role = 'etudiant'
       and nullif(btrim(p.email), '') is not null
       and ($2::text = '' or lower(p.email) = $2)
       and not exists (
         select 1
         from public.annual_access_passes pass
         where pass.user_id = p.id
           and pass.status = 'active'
           and pass.expires_at > now()
       )
     order by p.created_at desc
     limit 50`,
    [CAMPAIGN_KEY, targetEmail]
  );

  return NextResponse.json({ ok: true, jobs: result.rows.map(buildJob) });
}

export async function POST(request: Request) {
  const context = createServerContext();
  if (!context) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });
  if (!await authenticate(request, context)) return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 401 });

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
       and campaign_key = $5
     returning id, delivery_status`,
    [jobId, profileId, sent, String(body.error || "Envoi Google Apps Script impossible."), CAMPAIGN_KEY]
  );

  const row = result.rows[0];
  if (!row) return NextResponse.json({ ok: false, error: "Relance introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true, data: row });
}
