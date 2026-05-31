/**
 * Add this worker to the existing Institut Saint Irenee Apps Script project.
 * It reuses the WEBHOOK_SECRET already declared by that project.
 * Create a time-based trigger for sendQueuedLearningDocuments after deployment.
 */
const LEARNING_DOCUMENTS_API_URL = "https://irenee-institut.org/api/automation/learning-documents";

function sendQueuedLearningDocuments() {
  var queueResponse = UrlFetchApp.fetch(LEARNING_DOCUMENTS_API_URL, {
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    muteHttpExceptions: true
  });
  var queue = JSON.parse(queueResponse.getContentText() || "{}");
  if (queueResponse.getResponseCode() !== 200 || queue.ok !== true) {
    throw new Error(queue.error || "Unable to load the Supabase-backed mail queue.");
  }

  (queue.jobs || []).forEach(function (job) {
    try {
      var attachment = Utilities.newBlob(
        Utilities.base64Decode(job.attachmentBase64),
        job.attachmentMimeType,
        job.filename
      );
      GmailApp.sendEmail(job.to, job.subject, "Votre document est joint à cet email.", {
        attachments: [attachment],
        htmlBody: job.htmlBody,
        name: "Institut d'apologétique saint Irénée"
      });
      acknowledgeLearningDocument(job.documentId, true, "");
    } catch (error) {
      acknowledgeLearningDocument(job.documentId, false, String(error));
    }
  });
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
