import { siteUrl } from "@/lib/seo";
import { pgInsert, pgRead } from "@/lib/postgres";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/settings";
import { createServerContext } from "@/lib/postgres";

export const runtime = "nodejs";

const ADMIN_RECIPIENTS = ["sam3ams@gmail.com"];
const SITE_URL = siteUrl;
const LOGO_URL = `${SITE_URL}/images/apostolos/wordmark.png`;

type ProfileRow = {
  email?: string | null;
  nom?: string | null;
  prenom?: string | null;
};

type AnnualPassRow = {
  id: string;
  user_id: string;
  provider_order_id?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  status?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  profiles?: ProfileRow | ProfileRow[] | null;
};

type AnnualPassEmailAudience = "admin" | "student";

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

function profileFromPass(pass: AnnualPassRow): ProfileRow {
  if (Array.isArray(pass.profiles)) return pass.profiles[0] || {};
  return pass.profiles || {};
}

function recipientName(profile: ProfileRow) {
  return `${profile.prenom || ""} ${profile.nom || ""}`.trim() || profile.email || "etudiant";
}

function formatDate(value?: string | null) {
  if (!value) return "Non renseignee";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(value));
}

function formatPrice(amount: number | null | undefined, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format((amount || 0) / 100);
}

function emailShell({ body, eyebrow, preview, title }: { body: string; eyebrow: string; preview: string; title: string }) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f7f6ee;padding:0;font-family:Arial,Helvetica,sans-serif;color:#193f34">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f6ee;padding:28px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;border:1px solid rgba(220,180,107,.55);background:#ffffff;border-radius:8px;overflow:hidden">
            <tr>
              <td style="padding:26px 28px 18px;border-bottom:1px solid rgba(220,180,107,.28);background:linear-gradient(180deg,#f0eee4,#f7f6ee)">
                <img src="${LOGO_URL}" width="230" alt="Institut Apostolos Saint Irénée" style="display:block;width:230px;max-width:100%;height:auto;border:0;margin-bottom:20px">
                <div style="color:#8b422a;font-weight:700;text-transform:uppercase;font-size:12px;letter-spacing:.08em">${escapeHtml(eyebrow)}</div>
                <h1 style="margin:8px 0 0;color:#193f34;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.1">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#35483f;font-size:16px;line-height:1.65">
                ${body}
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

function studentHtml(pass: AnnualPassRow, profile: ProfileRow) {
  const name = recipientName(profile);
  return emailShell({
    eyebrow: "Pass annuel activé",
    preview: "Votre pass annuel Institut Apostolos Saint Irénée est actif.",
    title: "Bienvenue dans le cursus annuel",
    body: `
      <p style="margin:0 0 16px">Bonjour ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px">Votre pass annuel de l'Institut Apostolos Saint Irénée est bien actif. Vous pouvez acceder a l'ensemble du cursus depuis votre espace etudiant.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid rgba(220,180,107,.28);border-radius:8px;background:rgba(220,180,107,.06)">
        <tr><td style="padding:14px 16px;color:#193f34;font-weight:700">Validite</td><td style="padding:14px 16px;color:#35483f">${escapeHtml(formatDate(pass.starts_at))} - ${escapeHtml(formatDate(pass.expires_at))}</td></tr>
        <tr><td style="padding:14px 16px;color:#193f34;font-weight:700;border-top:1px solid rgba(220,180,107,.18)">Commande</td><td style="padding:14px 16px;color:#35483f;border-top:1px solid rgba(220,180,107,.18)">${escapeHtml(pass.provider_order_id || "Paiement en ligne")}</td></tr>
      </table>
      <p style="margin:0 0 22px">Vous recevrez les documents pedagogiques et certificats par email au fur et a mesure de votre progression.</p>
      <p style="margin:0"><a href="${SITE_URL}/espace-etudiant" style="display:inline-block;background:#e5b78b;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:6px">Ouvrir mon espace etudiant</a></p>
    `
  });
}

function adminHtml(pass: AnnualPassRow, profile: ProfileRow) {
  const name = recipientName(profile);
  return emailShell({
    eyebrow: "Nouvelle souscription",
    preview: `${name} vient de souscrire au pass annuel.`,
    title: "Nouveau pass annuel",
    body: `
      <p style="margin:0 0 16px"><strong style="color:#193f34">${escapeHtml(name)}</strong> vient de souscrire au pass annuel.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid rgba(220,180,107,.28);border-radius:8px;background:rgba(220,180,107,.06)">
        <tr><td style="padding:14px 16px;color:#193f34;font-weight:700">Email</td><td style="padding:14px 16px;color:#35483f">${escapeHtml(profile.email || "Non renseigne")}</td></tr>
        <tr><td style="padding:14px 16px;color:#193f34;font-weight:700;border-top:1px solid rgba(220,180,107,.18)">Montant</td><td style="padding:14px 16px;color:#35483f;border-top:1px solid rgba(220,180,107,.18)">${escapeHtml(formatPrice(pass.amount_total, pass.currency || "EUR"))}</td></tr>
        <tr><td style="padding:14px 16px;color:#193f34;font-weight:700;border-top:1px solid rgba(220,180,107,.18)">Commande</td><td style="padding:14px 16px;color:#35483f;border-top:1px solid rgba(220,180,107,.18)">${escapeHtml(pass.provider_order_id || "Non renseignee")}</td></tr>
        <tr><td style="padding:14px 16px;color:#193f34;font-weight:700;border-top:1px solid rgba(220,180,107,.18)">Expiration</td><td style="padding:14px 16px;color:#35483f;border-top:1px solid rgba(220,180,107,.18)">${escapeHtml(formatDate(pass.expires_at))}</td></tr>
      </table>
      <p style="margin:0"><a href="${SITE_URL}/admin/access" style="display:inline-block;background:#e5b78b;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:6px">Voir les acces etudiants</a></p>
    `
  });
}

function buildJob(pass: AnnualPassRow, audience: AnnualPassEmailAudience, to: string) {
  const profile = profileFromPass(pass);
  const name = recipientName(profile);
  const jobId = `annual-pass-${audience}-email:${pass.id}:${to}`;
  return {
    audience,
    jobId,
    passId: pass.id,
    subject: audience === "student"
      ? "Votre pass annuel Institut Apostolos Saint Irénée est actif"
      : `Nouvelle souscription pass annuel - ${name}`,
    textBody: audience === "student"
      ? `Bonjour ${name}, votre pass annuel Institut Apostolos Saint Irénée est actif.`
      : `${name} (${profile.email || "email non renseigne"}) vient de souscrire au pass annuel.`,
    htmlBody: audience === "student" ? studentHtml(pass, profile) : adminHtml(pass, profile),
    to,
    userId: pass.user_id
  };
}

export async function GET(request: Request) {
  const context = createServerContext();
  if (!context) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });
  if (!await authenticate(request, context)) return NextResponse.json({ ok: false, error: "Acces refuse." }, { status: 401 });

  const url = new URL(request.url);
  const targetEmail = url.searchParams.get("email")?.trim().toLowerCase() || "";
  const includeStudent = url.searchParams.get("student") !== "0";
  const includeAdmin = url.searchParams.get("admin") !== "0";

  const { data, error } = await pgRead("select t.*, (select to_jsonb(nested) from (select r.\"email\", r.\"nom\", r.\"prenom\" from public.\"profiles\" r where r.\"id\" = t.\"user_id\" limit 1) nested) as \"profiles\" from public.\"annual_access_passes\" t where t.\"status\" = $1 and t.\"expires_at\" > $2 order by t.\"created_at\" asc limit $3", ["active", new Date().toISOString(), 50], "many");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const passes = ((data || []) as AnnualPassRow[]).filter(pass => {
    if (!targetEmail) return true;
    return String(profileFromPass(pass).email || "").trim().toLowerCase() === targetEmail;
  });

  const candidates = passes.flatMap(pass => {
    const profile = profileFromPass(pass);
    const studentEmail = String(profile.email || "").trim();
    return [
      ...(includeStudent && studentEmail ? [buildJob(pass, "student", studentEmail)] : []),
      ...(includeAdmin ? ADMIN_RECIPIENTS.map(recipient => buildJob(pass, "admin", recipient)) : [])
    ];
  });

  const eventIds = candidates.map(job => job.jobId);
  const sentResult = eventIds.length
    ? await pgRead("select t.\"provider_event_id\" from public.\"payment_events\" t where t.\"provider\" = $1 and t.\"status\" = $2 and t.\"provider_event_id\" = any($3)", ["email", "sent", eventIds], "many")
    : { data: [], error: null };

  if (sentResult.error) return NextResponse.json({ ok: false, error: sentResult.error.message }, { status: 400 });
  const sentIds = new Set((sentResult.data || []).map(row => row.provider_event_id));

  return NextResponse.json({ ok: true, jobs: candidates.filter(job => !sentIds.has(job.jobId)) });
}

export async function POST(request: Request) {
  const context = createServerContext();
  if (!context) return NextResponse.json({ ok: false, error: "Service indisponible." }, { status: 501 });
  if (!await authenticate(request, context)) return NextResponse.json({ ok: false, error: "Acces refuse." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const jobId = String(body.jobId || "").trim();
  const passId = String(body.passId || "").trim();
  if (!jobId || !passId) return NextResponse.json({ ok: false, error: "jobId et passId requis." }, { status: 400 });

  const { data: pass, error: passError } = await pgRead("select t.\"id\", t.\"user_id\", t.\"provider_order_id\", t.\"amount_total\", t.\"currency\" from public.\"annual_access_passes\" t where t.\"id\" = $1", [passId], "optional");

  if (passError) return NextResponse.json({ ok: false, error: passError.message }, { status: 400 });

  const sent = body.ok === true;
  const { data, error } = await pgInsert("payment_events", {
    amount_total: pass?.amount_total || null,
    currency: pass?.currency || "EUR",
    event_name: jobId.includes("student") ? "annual_pass_student_confirmation_email" : "annual_pass_admin_notification_email",
    order_id: pass?.provider_order_id || null,
    provider: "email",
    provider_event_id: jobId,
    raw_payload: {
      audience: body.audience || null,
      error: body.error || null,
      pass_id: passId,
      provider_id: body.providerId || null,
      to: body.to || null
    },
    status: sent ? "sent" : "error",
    user_id: pass?.user_id || null
  }, { returning: "one", columns: "id,status", conflict: ["provider","provider_event_id"] });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
