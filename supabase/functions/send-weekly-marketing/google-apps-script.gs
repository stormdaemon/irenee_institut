const RECIPIENTS = [
  "sam3ams@gmail.com",
  "tlafont49@gmail.com",
  "oeuvrecatholiquefrance@gmail.com"
];

const WEBHOOK_SECRET = "REPLACE_WITH_THE_EXISTING_WEBHOOK_SECRET";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");

    if (payload.secret !== WEBHOOK_SECRET) {
      return json({ ok: false, error: "Unauthorized" });
    }

    if (payload.registration) return sendRegistrationNotification(payload.registration);
    if (payload.campaign) return sendCampaignEmail(payload.campaign);
    return json({ ok: false, error: "Unsupported payload" });
  } catch (error) {
    return json({ ok: false, error: String(error) });
  }
}

function sendRegistrationNotification(registration) {
  const fullName = [registration.prenom, registration.nom].filter(Boolean).join(" ") || "Non renseigné";

  if (!registration.email) return json({ ok: false, error: "Missing registration email" });
  if (MailApp.getRemainingDailyQuota() < RECIPIENTS.length) return json({ ok: false, error: "Daily Gmail quota reached" });

  MailApp.sendEmail({
    to: RECIPIENTS.join(","),
    subject: "Nouvelle inscription sur Institut Irénée",
    body: [
      "Une nouvelle inscription vient d'être effectuée.",
      "",
      `Nom : ${fullName}`,
      `Email : ${registration.email}`,
      `Date : ${registration.created_at || new Date().toISOString()}`
    ].join("\n"),
    name: "Institut Irénée"
  });

  return json({ ok: true });
}

function sendCampaignEmail(campaign) {
  if (!campaign.to || !campaign.subject || !campaign.body) return json({ ok: false, error: "Invalid campaign email" });
  if (MailApp.getRemainingDailyQuota() < 1) return json({ ok: false, error: "Daily Gmail quota reached" });

  MailApp.sendEmail({
    to: campaign.to,
    subject: campaign.subject,
    body: campaign.body,
    htmlBody: campaign.htmlBody || undefined,
    name: "Institut Irénée"
  });

  return json({ ok: true });
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
