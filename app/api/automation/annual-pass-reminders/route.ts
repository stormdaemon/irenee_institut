import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { annualPassCheckoutPath, cleanAnnualPassSignupPath } from "@/lib/routes";
import { getSystemSettings } from "@/lib/settings";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

const CAMPAIGN_KEY = "annual-pass-account-reminder-2026-09";
const SITE_URL = "https://irenee-institut.org";
const SIGNUP_URL = `${SITE_URL}${cleanAnnualPassSignupPath}`;
const CHECKOUT_URL = `${SITE_URL}${annualPassCheckoutPath}`;
const LOGO_URL = `${SITE_URL}/images/logo_with_text.png`;

type ReminderRow = {
  created_at?: string | null;
  delivery_id: string;
  email: string;
  nom?: string | null;
  prenom?: string | null;
  profile_id: string;
};

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

function recipientName(profile: Pick<ReminderRow, "email" | "nom" | "prenom">) {
  return `${profile.prenom || ""} ${profile.nom || ""}`.trim() || profile.email || "cher étudiant";
}

function reminderHtml(profile: ReminderRow) {
  const name = recipientName(profile);
  return `<!doctype html>
<html>
  <body style="margin:0;background:#04101e;padding:0;font-family:Arial,Helvetica,sans-serif;color:#f8f1df">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent">Premières rencontres en visio conférence à partir de septembre 2026.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#04101e;padding:28px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;border:1px solid rgba(220,180,107,.55);background:#071523;border-radius:8px;overflow:hidden">
            <tr>
              <td style="padding:26px 28px 18px;border-bottom:1px solid rgba(220,180,107,.28);background:linear-gradient(180deg,#071724,#03111f)">
                <img src="${LOGO_URL}" width="230" alt="Institut d'Apologétique Saint Irénée" style="display:block;width:230px;max-width:100%;height:auto;border:0;margin-bottom:20px">
                <div style="color:#f0cf8a;font-weight:700;text-transform:uppercase;font-size:12px;letter-spacing:.08em">Rentrée académique 2026</div>
                <h1 style="margin:8px 0 0;color:#fff7e7;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.1">Activez votre pass annuel</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#f0dfc2;font-size:16px;line-height:1.65">
                <p style="margin:0 0 16px">Bonjour ${escapeHtml(name)},</p>
                <p style="margin:0 0 16px">Votre inscription à l'Institut Saint Irénée est bien enregistrée, mais aucun pass annuel actif n'est encore associé à votre compte.</p>
                <p style="margin:0 0 16px"><strong style="color:#fff7e7">Premières rencontres en visio conférence à partir de septembre 2026.</strong> Pour accéder au cursus, aux séances en direct et aux documents pédagogiques, activez votre compte pass annuel.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid rgba(220,180,107,.28);border-radius:8px;background:rgba(220,180,107,.06)">
                  <tr>
                    <td style="padding:16px;color:#f0dfc2">Le pass annuel donne accès pendant 365 jours au cursus d'apologétique, à votre espace étudiant et aux validations de progression.</td>
                  </tr>
                </table>
                <p style="margin:0 0 12px"><a href="${SIGNUP_URL}" style="display:inline-block;background:#dcb46b;color:#071523;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:6px">Créer mon compte pass annuel</a></p>
                <p style="margin:0;color:#d8c9ad;font-size:14px">Si vous avez déjà un compte, connectez-vous avec cette adresse email puis choisissez le pass annuel : <a href="${CHECKOUT_URL}" style="color:#f0cf8a;text-decoration:none">${CHECKOUT_URL}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;color:#d8c9ad;border-top:1px solid rgba(220,180,107,.22);font-size:13px">
                Institut d'Apologétique Saint Irénée - ${SITE_URL}
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
    subject: "Activez votre pass annuel Institut Saint Irénée",
    textBody: [
      `Bonjour ${name},`,
      "",
      "Votre inscription à l'Institut Saint Irénée est bien enregistrée, mais aucun pass annuel actif n'est encore associé à votre compte.",
      "",
      "Premières rencontres en visio conférence à partir de septembre 2026.",
      "",
      "Pour accéder au cursus, aux séances en direct et aux documents pédagogiques, activez votre compte pass annuel :",
      SIGNUP_URL,
      "",
      "Si vous avez déjà un compte, connectez-vous avec cette adresse email puis choisissez le pass annuel :",
      CHECKOUT_URL,
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
       and campaign_key = $5
     returning id, delivery_status`,
    [jobId, profileId, sent, String(body.error || "Envoi Google Apps Script impossible."), CAMPAIGN_KEY]
  );

  const row = result.rows[0];
  if (!row) return NextResponse.json({ ok: false, error: "Relance introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true, data: row });
}
