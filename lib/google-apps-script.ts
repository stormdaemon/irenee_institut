import { query } from "@/lib/db";
import type { ContactInput } from "@/lib/contact";
import { safeInternalPath } from "@/lib/request-security";

type RegistrationProfile = {
  created_at?: string | null;
  email: string;
  id: string;
  nom?: string | null;
  prenom?: string | null;
};

const mandatoryCampaignKey = "mandatory-registration-onboarding";

function appsScriptConfig() {
  return {
    secret: process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET || process.env.GOOGLE_APPS_SCRIPT_MAIL_SECRET || "",
    url: process.env.GOOGLE_APPS_SCRIPT_URL || ""
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function postAppsScript(payload: Record<string, unknown>) {
  const { secret, url } = appsScriptConfig();
  if (!url || !secret) throw new Error("Google Apps Script is not configured.");

  const response = await fetch(url, {
    body: JSON.stringify({ secret, ...payload }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error || `Google Apps Script HTTP ${response.status}`);
  }
  return data;
}

export async function sendEmailVerification(input: {
  email: string;
  nom?: string | null;
  prenom?: string | null;
  token: string;
  nextPath?: string;
}) {
  const nextPath = safeInternalPath(input.nextPath, "/espace-etudiant");
  const confirmationUrl = new URL("/auth/callback", "https://irenee-institut.org");
  confirmationUrl.searchParams.set("next", nextPath);
  // Keep the one-time credential out of HTTP requests, reverse-proxy access
  // logs and referrer headers. The callback erases the fragment immediately.
  confirmationUrl.hash = new URLSearchParams({ code: input.token }).toString();
  const displayName = `${input.prenom || ""} ${input.nom || ""}`.trim() || "cher étudiant";
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(confirmationUrl.toString());

  return postAppsScript({
    campaign: {
      body: `Bonjour ${displayName},\n\nConfirmez votre adresse email pour activer votre compte Institut Saint Irénée :\n${confirmationUrl.toString()}\n\nCe lien expire dans 24 heures.`,
      htmlBody: `<p>Bonjour <strong>${safeName}</strong>,</p><p>Confirmez votre adresse email pour activer votre compte Institut Saint Irénée.</p><p><a href="${safeUrl}">Confirmer mon adresse email</a></p><p>Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
      subject: "Confirmez votre compte Institut Saint Irénée",
      to: input.email
    }
  });
}

export async function sendPasswordResetEmail(input: {
  email: string;
  nom?: string | null;
  prenom?: string | null;
  token: string;
}) {
  const resetUrl = new URL("/auth/password-reset", "https://irenee-institut.org");
  // Fragments are not included in HTTP requests, reverse-proxy access logs or
  // referrer headers. The client removes this value from history immediately.
  resetUrl.hash = new URLSearchParams({ code: input.token }).toString();
  const displayName = `${input.prenom || ""} ${input.nom || ""}`.trim() || "cher étudiant";
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(resetUrl.toString());

  return postAppsScript({
    campaign: {
      body: `Bonjour ${displayName},\n\nUne réinitialisation du mot de passe de votre compte Institut Saint Irénée a été demandée :\n${resetUrl.toString()}\n\nCe lien à usage unique expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.`,
      htmlBody: `<p>Bonjour <strong>${safeName}</strong>,</p><p>Une réinitialisation du mot de passe de votre compte Institut Saint Irénée a été demandée.</p><p><a href="${safeUrl}">Choisir un nouveau mot de passe</a></p><p>Ce lien à usage unique expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message&nbsp;: votre mot de passe reste inchangé.</p>`,
      subject: "Réinitialiser votre mot de passe Institut Saint Irénée",
      to: input.email
    }
  });
}

export async function sendContactMessage(input: ContactInput) {
  const fullName = `${input.prenom} ${input.nom}`.trim();
  const phone = input.telephone || "Non renseigné";
  const recipient = process.env.CONTACT_RECIPIENT_EMAIL || "oeuvrecatholiquefrance@gmail.com";
  const safeMessage = escapeHtml(input.message).replace(/\r?\n/g, "<br>");

  return postAppsScript({
    campaign: {
      body: [
        `Nouveau message envoyé depuis irenee-institut.org`,
        "",
        `Nom : ${fullName}`,
        `Email : ${input.email}`,
        `Téléphone : ${phone}`,
        `Sujet : ${input.sujet}`,
        "",
        input.message
      ].join("\n"),
      htmlBody: `<p><strong>Nouveau message envoyé depuis irenee-institut.org</strong></p><p><strong>Nom :</strong> ${escapeHtml(fullName)}<br><strong>Email :</strong> ${escapeHtml(input.email)}<br><strong>Téléphone :</strong> ${escapeHtml(phone)}<br><strong>Sujet :</strong> ${escapeHtml(input.sujet)}</p><p>${safeMessage}</p>`,
      subject: `Contact site — ${input.sujet}`,
      to: recipient
    }
  });
}

function welcomeRegistrationFor(profile: RegistrationProfile) {
  return {
    contactEmail: "contact@irenee-institut.org",
    dashboardUrl: "https://irenee-institut.org/espace-etudiant",
    email: profile.email,
    nom: profile.nom || "",
    prenom: profile.prenom || "",
    programUrl: "https://irenee-institut.org/formations"
  };
}

function welcomeCampaignFor(profile: RegistrationProfile) {
  const firstName = profile.prenom || "";
  const lastName = profile.nom || "";
  const fullName = `${firstName} ${lastName}`.trim() || "cher étudiant";
  const logoUrl = "https://irenee-institut.org/_next/image?url=%2Fimages%2Flogo_without_text.png&w=96&q=75";
  const dashboardUrl = "https://irenee-institut.org/espace-etudiant";
  const programUrl = "https://irenee-institut.org/formations";
  const contactEmail = "contact@irenee-institut.org";

  return {
    body: [
      `Bonjour ${fullName},`,
      "",
      "Bienvenue à l’Institut d’Apologétique Saint Irénée.",
      "",
      "Votre inscription a bien été prise en compte.",
      "",
      "Vous rejoignez un parcours de formation conçu pour approfondir la foi catholique et apprendre à la défendre avec rigueur, clarté et bienveillance.",
      "",
      "Accéder au site :",
      dashboardUrl,
      "",
      "Découvrir le programme :",
      programUrl,
      "",
      `En cas de question, vous pouvez nous contacter à cette adresse : ${contactEmail}`,
      "",
      "Que cette formation vous aide à rendre compte de la crédibilité de la foi catholique.",
      "",
      "Institut d’Apologétique Saint Irénée"
    ].join("\n"),
    htmlBody: `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#06111c;font-family:Arial,Helvetica,sans-serif;color:#f7f1df;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#06111c;margin:0;padding:32px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#081724;border:1px solid #c8a24a;border-radius:14px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:26px 32px 8px 32px;background:#07121e;">
                <img src="${logoUrl}" alt="Institut Saint Irénée" width="96" height="96" style="display:block;width:96px;height:96px;margin:0 auto 12px auto;border:0;outline:none;text-decoration:none;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#ffffff;line-height:1.2;">Institut Saint Irénée</div>
                <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#d9b85f;margin-top:6px;">Institut d’Apologétique</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 24px 32px;background:linear-gradient(135deg,#07121e 0%,#0c2232 55%,#07121e 100%);border-top:1px solid rgba(200,162,74,0.45);border-bottom:1px solid #c8a24a;">
                <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#d9b85f;margin-bottom:10px;">Inscription confirmée</div>
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.08;color:#ffffff;">
                  Bienvenue à l’Institut<br>
                  <span style="color:#f1d27a;">Saint Irénée</span>
                </h1>
                <p style="margin:14px 0 0 0;font-size:16px;line-height:1.6;color:#f7f1df;">Rendre compte de la crédibilité de la foi catholique.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 10px 32px;">
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#f7f1df;">Bonjour <strong style="color:#f1d27a;">${escapeHtml(fullName)}</strong>,</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#f7f1df;">Votre inscription à l’Institut d’Apologétique Saint Irénée a bien été prise en compte.</p>
                <p style="margin:0 0 22px 0;font-size:16px;line-height:1.7;color:#f7f1df;">Vous rejoignez un parcours de formation conçu pour approfondir votre foi catholique et apprendre à la défendre avec rigueur, clarté et bienveillance.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;background:#0b1d2c;border:1px solid rgba(200,162,74,0.55);border-radius:12px;">
                  <tr>
                    <td style="padding:20px 22px;">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:bold;color:#f1d27a;margin-bottom:10px;">Prochaines étapes</div>
                      <p style="margin:0;font-size:15px;line-height:1.7;color:#f7f1df;">Vous pouvez dès maintenant consulter les formations, suivre les informations publiées par l’Institut et préparer votre parcours étudiant.</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 12px 0;">
                  <tr>
                    <td style="border-radius:6px;background:#9d1f16;border:1px solid #d0a74f;">
                      <a href="${dashboardUrl}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:bold;letter-spacing:.4px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Accéder au site</a>
                    </td>
                    <td style="width:12px;"></td>
                    <td style="border-radius:6px;background:#081724;border:1px solid #d0a74f;">
                      <a href="${programUrl}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:bold;letter-spacing:.4px;text-transform:uppercase;color:#f7f1df;text-decoration:none;">Voir le programme</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0 0;font-size:15px;line-height:1.7;color:#d8d0bd;">
                  En cas de question, vous pouvez nous écrire à
                  <a href="mailto:${contactEmail}" style="color:#f1d27a;text-decoration:none;">${contactEmail}</a>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 30px 32px;">
                <div style="height:1px;background:linear-gradient(90deg,transparent,#c8a24a,transparent);margin-bottom:20px;"></div>
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.6;color:#ffffff;">Que cette formation vous aide à rendre compte de la foi avec intelligence, charité et courage.</p>
                <p style="margin:18px 0 0 0;font-size:14px;line-height:1.6;color:#d8d0bd;">Institut d’Apologétique Saint Irénée</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    subject: "Bienvenue à l’Institut Saint Irénée",
    to: profile.email
  };
}

async function postWelcomeRegistration(profile: RegistrationProfile) {
  try {
    await postAppsScript({ welcomeRegistration: welcomeRegistrationFor(profile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("unsupported payload")) throw error;
    await postAppsScript({ campaign: welcomeCampaignFor(profile) });
  }
}

export async function runRegistrationAutomation(profile: RegistrationProfile) {
  const warnings: string[] = [];

  try {
    await postAppsScript({
      registration: {
        created_at: profile.created_at,
        email: profile.email,
        nom: profile.nom || "",
        prenom: profile.prenom || ""
      }
    });
    await query(
      `update public.registration_notification_outbox
       set delivery_status = 'sent', sent_at = now(), last_error = null, attempt_count = attempt_count + 1, updated_at = now()
       where user_id = $1`,
      [profile.id]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`registration:${message}`);
    await query(
      `update public.registration_notification_outbox
       set delivery_status = 'failed', last_error = $2, attempt_count = attempt_count + 1, updated_at = now()
       where user_id = $1`,
      [profile.id, message]
    ).catch(() => undefined);
  }

  try {
    await postWelcomeRegistration(profile);
  } catch (error) {
    warnings.push(`welcome:${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await query(
      `insert into public.marketing_campaign_deliveries (profile_id, campaign_key, delivery_status, attempt_count, updated_at)
       values ($1, $2, 'pending', 0, now())
       on conflict (profile_id, campaign_key) do nothing`,
      [profile.id, mandatoryCampaignKey]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`campaign:${message}`);
  }

  return warnings;
}
