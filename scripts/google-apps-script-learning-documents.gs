/**
 * Add this worker to the existing Institut Saint Irenee Apps Script project.
 * It reuses the WEBHOOK_SECRET already declared by that project.
 * Create a time-based trigger for sendQueuedLearningDocuments after deployment.
 */
const LEARNING_DOCUMENTS_API_URL = "https://irenee-institut.org/api/automation/learning-documents";
const ANNUAL_PASS_EMAILS_API_URL = "https://irenee-institut.org/api/automation/annual-pass-emails";
const ANNUAL_PASS_REMINDERS_API_URL = "https://irenee-institut.org/api/automation/annual-pass-reminders";
const LEARNING_DOCUMENTS_MAX_ATTACHMENTS_PER_EMAIL = 20;

function sendInstitutQueuedEmails() {
  sendQueuedLearningDocuments();
  sendQueuedAnnualPassEmails();
  sendQueuedAnnualPassReminderEmails();
}

function sendQueuedLearningDocuments() {
  var queueResponse = UrlFetchApp.fetch(LEARNING_DOCUMENTS_API_URL, {
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    muteHttpExceptions: true
  });
  var queue = JSON.parse(queueResponse.getContentText() || "{}");
  if (queueResponse.getResponseCode() !== 200 || queue.ok !== true) {
    throw new Error(queue.error || "Unable to load the Supabase-backed mail queue.");
  }

  var jobsByRecipient = {};
  (queue.jobs || []).forEach(function (job) {
    jobsByRecipient[job.to] = jobsByRecipient[job.to] || [];
    jobsByRecipient[job.to].push(job);
  });

  Object.keys(jobsByRecipient).forEach(function (recipient) {
    var recipientJobs = jobsByRecipient[recipient];
    for (var index = 0; index < recipientJobs.length; index += LEARNING_DOCUMENTS_MAX_ATTACHMENTS_PER_EMAIL) {
      sendLearningDocumentBatch(recipient, recipientJobs.slice(index, index + LEARNING_DOCUMENTS_MAX_ATTACHMENTS_PER_EMAIL));
    }
  });
}

function sendLearningDocumentBatch(recipient, jobs) {
  try {
    var attachments = jobs.map(function (job) {
      return Utilities.newBlob(
        Utilities.base64Decode(job.attachmentBase64),
        job.attachmentMimeType,
        job.filename
      );
    });
    var certificateIncluded = jobs.some(function (job) {
      return job.filename.indexOf("certificat-apologetique-") === 0;
    });
    var subject = jobs.length === 1
      ? jobs[0].subject
      : certificateIncluded
        ? "Vos parchemins et votre certificat nominatif d'apologétique"
        : "Vos parchemins de connaissance";
    var htmlBody = jobs.length === 1
      ? jobs[0].htmlBody
      : "<p>Bonjour,</p><p>Vous trouverez en pièces jointes vos " + jobs.length + " documents pédagogiques délivrés par l'Institut d'apologétique saint Irénée.</p><p>Vous pouvez également les retrouver dans votre espace étudiant.</p>";

    GmailApp.sendEmail(recipient, subject, "Vos documents sont joints à cet email.", {
      attachments: attachments,
      htmlBody: htmlBody,
      name: "Institut d'apologétique saint Irénée"
    });
    jobs.forEach(function (job) {
      acknowledgeLearningDocument(job.documentId, true, "");
    });
  } catch (error) {
    jobs.forEach(function (job) {
      acknowledgeLearningDocument(job.documentId, false, String(error));
    });
  }
}

function acknowledgeLearningDocument(documentId, ok, error) {
  UrlFetchApp.fetch(LEARNING_DOCUMENTS_API_URL, {
    contentType: "application/json",
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    method: "post",
    muteHttpExceptions: true,
    payload: JSON.stringify({ documentId: documentId, error: error, ok: ok })
  });
}

function sendQueuedAnnualPassEmails() {
  sendAnnualPassEmailQueue_(ANNUAL_PASS_EMAILS_API_URL);
}

function sendAnnualPassEmailsForLaurentRouh() {
  sendAnnualPassEmailQueue_(ANNUAL_PASS_EMAILS_API_URL + "?email=" + encodeURIComponent("laurent.rh@hotmail.fr"));
}

function sendAnnualPassEmailQueue_(url) {
  var queueResponse = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    muteHttpExceptions: true
  });
  var queue = JSON.parse(queueResponse.getContentText() || "{}");
  if (queueResponse.getResponseCode() !== 200 || queue.ok !== true) {
    throw new Error(queue.error || "Unable to load the annual pass mail queue.");
  }

  (queue.jobs || []).forEach(function (job) {
    sendAnnualPassEmailJob_(job);
  });
}

function sendAnnualPassEmailJob_(job) {
  try {
    var sent = GmailApp.sendEmail(job.to, job.subject, job.textBody || job.subject, {
      htmlBody: job.htmlBody,
      name: "Institut d'apologetique saint Irenee"
    });
    acknowledgeAnnualPassEmail_(job, true, "", sent && sent.getId ? sent.getId() : "");
  } catch (error) {
    acknowledgeAnnualPassEmail_(job, false, String(error), "");
  }
}

function acknowledgeAnnualPassEmail_(job, ok, error, providerId) {
  UrlFetchApp.fetch(ANNUAL_PASS_EMAILS_API_URL, {
    contentType: "application/json",
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    method: "post",
    muteHttpExceptions: true,
    payload: JSON.stringify({
      audience: job.audience,
      error: error,
      jobId: job.jobId,
      ok: ok,
      passId: job.passId,
      providerId: providerId,
      to: job.to
    })
  });
}

function sendQueuedAnnualPassReminderEmails() {
  sendAnnualPassReminderQueue_(ANNUAL_PASS_REMINDERS_API_URL);
}

function sendAnnualPassReminderEmailsFor(email) {
  sendAnnualPassReminderQueue_(ANNUAL_PASS_REMINDERS_API_URL + "?email=" + encodeURIComponent(email));
}

function sendAnnualPassReminderQueue_(url) {
  var queueResponse = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    muteHttpExceptions: true
  });
  var queue = JSON.parse(queueResponse.getContentText() || "{}");
  if (queueResponse.getResponseCode() !== 200 || queue.ok !== true) {
    throw new Error(queue.error || "Unable to load the annual pass reminder queue.");
  }

  (queue.jobs || []).forEach(function (job) {
    sendAnnualPassReminderJob_(job);
  });
}

function sendAnnualPassReminderJob_(job) {
  try {
    var sent = GmailApp.sendEmail(job.to, job.subject, job.textBody || job.subject, {
      htmlBody: job.htmlBody,
      name: "Institut d'apologétique saint Irénée"
    });
    acknowledgeAnnualPassReminder_(job, true, "", sent && sent.getId ? sent.getId() : "");
  } catch (error) {
    acknowledgeAnnualPassReminder_(job, false, String(error), "");
  }
}

function acknowledgeAnnualPassReminder_(job, ok, error, providerId) {
  UrlFetchApp.fetch(ANNUAL_PASS_REMINDERS_API_URL, {
    contentType: "application/json",
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    method: "post",
    muteHttpExceptions: true,
    payload: JSON.stringify({
      campaignKey: job.campaignKey,
      error: error,
      jobId: job.jobId,
      ok: ok,
      profileId: job.profileId,
      providerId: providerId,
      to: job.to
    })
  });
}

function installInstitutEmailTrigger() {
  var handler = "sendInstitutQueuedEmails";
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction && trigger.getHandlerFunction() === handler;
  });

  if (!exists) {
    ScriptApp.newTrigger(handler).timeBased().everyMinutes(10).create();
  }
}

function installAnnualPassEmailTrigger() {
  var handler = "sendQueuedAnnualPassEmails";
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction && trigger.getHandlerFunction() === handler;
  });

  if (!exists) {
    ScriptApp.newTrigger(handler).timeBased().everyMinutes(10).create();
  }
}
