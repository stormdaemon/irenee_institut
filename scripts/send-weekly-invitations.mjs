// Pousse les invitations hebdomadaires au pass annuel vers le déploiement
// Google Apps Script (payload `campaign` de doPost), puis accuse réception
// auprès de l'API. Remplace le déclencheur time-based côté Apps Script :
// c'est le serveur qui pilote la cadence (timer systemd irenee-weekly-invitations).
//
// Environnement requis : GOOGLE_APPS_SCRIPT_URL, et
// GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET ou GOOGLE_APPS_SCRIPT_MAIL_SECRET.

const SITE_URL = process.env.IRENEE_SITE_URL || "https://irenee-institut.org";
const QUEUE_URL = `${SITE_URL}/api/automation/annual-pass-weekly`;
const APPS_SCRIPT_URL = (process.env.GOOGLE_APPS_SCRIPT_URL || "").trim();
const SECRET = (process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET || process.env.GOOGLE_APPS_SCRIPT_MAIL_SECRET || "").trim();
const PAUSE_BETWEEN_SENDS_MS = 1500;

if (!APPS_SCRIPT_URL || !SECRET) {
  console.error("weekly_invitations_failed", { stage: "configuration_missing" });
  process.exit(1);
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchQueue() {
  const response = await fetch(QUEUE_URL, {
    headers: { Authorization: `Bearer ${SECRET}` },
    signal: AbortSignal.timeout(20_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    throw new Error(`queue HTTP ${response.status}`);
  }
  return data.jobs || [];
}

async function sendThroughAppsScript(job) {
  const response = await fetch(APPS_SCRIPT_URL, {
    body: JSON.stringify({
      secret: SECRET,
      campaign: {
        to: job.to,
        subject: job.subject,
        body: job.textBody || job.subject,
        htmlBody: job.htmlBody
      }
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(30_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    throw new Error(data.error || `Apps Script HTTP ${response.status}`);
  }
}

async function acknowledge(job, ok, error) {
  const response = await fetch(QUEUE_URL, {
    body: JSON.stringify({
      campaignKey: job.campaignKey,
      error: error || "",
      jobId: job.jobId,
      ok,
      profileId: job.profileId
    }),
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) {
    console.error("weekly_invitations_ack_failed", { jobId: job.jobId, status: response.status });
  }
}

const jobs = await fetchQueue();
console.log(`weekly_invitations_queue: ${jobs.length} invitation(s) à envoyer`);

let sent = 0;
let failed = 0;
for (const job of jobs) {
  try {
    await sendThroughAppsScript(job);
    await acknowledge(job, true, "");
    sent += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await acknowledge(job, false, message);
    failed += 1;
    console.error("weekly_invitations_send_failed", { jobId: job.jobId, message });
    // Quota Gmail atteint : inutile d'insister, les relances repartiront au prochain cycle.
    if (/quota/i.test(message)) break;
  }
  await pause(PAUSE_BETWEEN_SENDS_MS);
}

console.log(`weekly_invitations_done: ${sent} envoyée(s), ${failed} échec(s)`);
process.exit(failed > 0 && sent === 0 ? 1 : 0);
