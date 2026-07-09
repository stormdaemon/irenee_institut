import { readFile } from "node:fs/promises";
import path from "node:path";
import { degrees, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { ANNUAL_PASS_NAME } from "@/lib/curriculum";
import {
  learningDocumentAchievement,
  learningDocumentIssuedAt,
  learningDocumentTitle,
  type LearningDocument
} from "@/lib/learning-documents";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;

function pdfText(value: unknown) {
  return String(value ?? "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/[–—]/g, "-")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/…/g, "...")
    .replace(/\u00a0/g, " ")
    .split("")
    .map(character => character.charCodeAt(0) <= 255 ? character : "?")
    .join("");
}

function centeredX(font: PDFFont, text: string, size: number) {
  return (PAGE_WIDTH - font.widthOfTextAtSize(text, size)) / 2;
}

function drawCentered(page: PDFPage, font: PDFFont, value: unknown, y: number, size: number, color = rgb(0.06, 0.17, 0.33)) {
  const text = pdfText(value);
  page.drawText(text, { x: centeredX(font, text, size), y, size, font, color });
}

function wrapText(font: PDFFont, value: unknown, size: number, maxWidth: number) {
  const words = pdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function drawCenteredLines(page: PDFPage, font: PDFFont, value: unknown, y: number, size: number, maxWidth: number, lineHeight: number, color = rgb(0.22, 0.15, 0.06)) {
  for (const [index, line] of wrapText(font, value, size, maxWidth).entries()) {
    drawCentered(page, font, line, y - index * lineHeight, size, color);
  }
}

function drawLaurelBranch(page: PDFPage, x: number, y: number, mirror = false) {
  const gold = rgb(0.69, 0.48, 0.2);
  const direction = mirror ? -1 : 1;
  page.drawLine({ start: { x, y }, end: { x: x + direction * 74, y: y + 56 }, color: gold, thickness: 2 });

  for (let index = 0; index < 7; index++) {
    const leafX = x + direction * (12 + index * 10);
    const leafY = y + 9 + index * 7;
    page.drawEllipse({ x: leafX, y: leafY + 7, xScale: 4, yScale: 10, rotate: degrees(direction * -38), color: gold });
    page.drawEllipse({ x: leafX + direction * 9, y: leafY, xScale: 4, yScale: 10, rotate: degrees(direction * 42), color: gold });
  }
}

export async function renderLearningDocumentPdf(document: LearningDocument) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "images", "logo_without_text_pdf.png")));

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(0.03, 0.11, 0.23) });
  page.drawRectangle({ x: 24, y: 24, width: PAGE_WIDTH - 48, height: PAGE_HEIGHT - 48, color: rgb(0.97, 0.89, 0.69) });
  page.drawRectangle({ x: 39, y: 39, width: PAGE_WIDTH - 78, height: PAGE_HEIGHT - 78, borderColor: rgb(0.69, 0.48, 0.2), borderWidth: 3 });
  page.drawRectangle({ x: 50, y: 50, width: PAGE_WIDTH - 100, height: PAGE_HEIGHT - 100, borderColor: rgb(0.1, 0.24, 0.41), borderWidth: 1 });
  page.drawLine({ start: { x: 64, y: 498 }, end: { x: PAGE_WIDTH - 64, y: 498 }, color: rgb(0.69, 0.48, 0.2), thickness: 1 });
  page.drawLine({ start: { x: 64, y: 96 }, end: { x: PAGE_WIDTH - 64, y: 96 }, color: rgb(0.69, 0.48, 0.2), thickness: 1 });

  page.drawImage(logo, { x: PAGE_WIDTH / 2 - 53, y: 466, width: 106, height: 106 });

  drawCentered(page, regular, "INSTITUT D'APOLOGETIQUE SAINT IRENEE", 448, 14, rgb(0.59, 0.4, 0.13));
  drawCentered(page, bold, learningDocumentTitle(document), 395, document.document_kind === "final_certificate" ? 32 : 29);
  drawCentered(page, regular, "est decerne a", 357, 16, rgb(0.44, 0.31, 0.13));
  drawCentered(page, italic, document.recipient_name, 306, 37);
  page.drawLine({ start: { x: 215, y: 289 }, end: { x: PAGE_WIDTH - 215, y: 289 }, color: rgb(0.69, 0.48, 0.2), thickness: 1.5 });
  drawCenteredLines(page, regular, learningDocumentAchievement(document), 248, 16, 660, 21);
  drawCentered(page, regular, ANNUAL_PASS_NAME, 185, 12, rgb(0.42, 0.29, 0.12));
  drawCentered(page, regular, `Delivre le ${learningDocumentIssuedAt(document)}`, 142, 13, rgb(0.22, 0.15, 0.06));
  drawCentered(page, regular, "Document pedagogique automatise - identite declaree, non verifiee par l'Institut", 119, 8, rgb(0.38, 0.27, 0.12));
  drawCentered(page, regular, "Verification : irenee-institut.org/verifier-document", 106, 8, rgb(0.38, 0.27, 0.12));

  page.drawLine({ start: { x: 80, y: 74 }, end: { x: 205, y: 74 }, color: rgb(0.43, 0.3, 0.13), thickness: 1 });
  page.drawText("Direction de l'Institut", { x: 88, y: 58, size: 10, font: regular, color: rgb(0.38, 0.27, 0.12) });
  page.drawLine({ start: { x: PAGE_WIDTH - 205, y: 74 }, end: { x: PAGE_WIDTH - 80, y: 74 }, color: rgb(0.43, 0.3, 0.13), thickness: 1 });
  page.drawText(pdfText(`Reference ${document.document_number}`), { x: PAGE_WIDTH - 198, y: 58, size: 10, font: regular, color: rgb(0.38, 0.27, 0.12) });

  page.drawCircle({ x: PAGE_WIDTH / 2, y: 74, size: 27, color: rgb(0.56, 0.13, 0.15) });
  page.drawCircle({ x: PAGE_WIDTH / 2, y: 74, size: 20, borderColor: rgb(0.85, 0.58, 0.39), borderWidth: 1 });
  drawLaurelBranch(page, PAGE_WIDTH / 2 - 29, 56, true);
  drawLaurelBranch(page, PAGE_WIDTH / 2 + 29, 56);
  drawCentered(page, regular, "SAINT", 76, 8, rgb(0.96, 0.83, 0.64));
  drawCentered(page, regular, "IRENEE", 65, 8, rgb(0.96, 0.83, 0.64));

  return pdf.save();
}
