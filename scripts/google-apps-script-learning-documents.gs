/**
 * Add this worker to the existing Institut Saint Irenee Apps Script project.
 * It reuses the WEBHOOK_SECRET already declared by that project.
 * Create a time-based trigger for sendQueuedLearningDocuments after deployment.
 */
const LEARNING_DOCUMENTS_API_URL = "https://irenee-institut.org/api/automation/learning-documents";
const LEARNING_DOCUMENTS_MAX_ATTACHMENTS_PER_EMAIL = 20;

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
