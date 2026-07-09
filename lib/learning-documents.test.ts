import test from "node:test";
import assert from "node:assert/strict";
import { renderLearningDocumentPdf } from "./learning-document-pdf";
import { learningDocumentFilename, renderLearningDocumentSvg, type LearningDocument } from "./learning-documents";

const certificate: LearningDocument = {
  document_kind: "final_certificate",
  document_number: "ISI-ABC123",
  id: "document-1",
  issued_at: "2026-05-31T12:00:00.000Z",
  recipient_name: "Anne & Martin"
};

test("renderLearningDocumentSvg creates a nominative printable certificate", () => {
  const svg = renderLearningDocumentSvg(certificate);

  assert.match(svg, /Certificat nominatif d&apos;apologétique/);
  assert.match(svg, /Anne &amp; Martin/);
  assert.match(svg, /ISI-ABC123/);
  assert.match(svg, /identité déclarée.*non vérifiée/i);
  assert.match(svg, /irenee-institut\.org\/verifier-document/);
  assert.equal(learningDocumentFilename(certificate), "certificat-apologetique-isi-abc123.pdf");
});

test("renderLearningDocumentPdf creates a downloadable PDF certificate", async () => {
  const pdf = await renderLearningDocumentPdf(certificate);

  assert.equal(Buffer.from(pdf).subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(pdf.length > 1000);
});
