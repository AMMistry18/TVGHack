import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ReportSections } from "../types.js";

const TITLE = "SB 6 / GRID Act Compliance Audit Report";
const MARGIN = 50;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LINE_HEIGHT = 14;
const SECTION_TITLE_SIZE = 12;
const BODY_SIZE = 10;
const MAX_WIDTH = PAGE_WIDTH - 2 * MARGIN;

function wrapText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  size: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildPdf(sections: ReportSections): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawSection = (
    title: string,
    body: string,
    isFirst: boolean
  ): void => {
    if (!isFirst && y < MARGIN + 80) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    if (!isFirst) y -= LINE_HEIGHT;
    page.drawText(title, {
      x: MARGIN,
      y,
      size: SECTION_TITLE_SIZE,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= LINE_HEIGHT;
    const bodyLines = wrapText(body, MAX_WIDTH, font, BODY_SIZE);
    for (const line of bodyLines) {
      if (y < MARGIN + 20) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(line, {
        x: MARGIN,
        y,
        size: BODY_SIZE,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= LINE_HEIGHT;
    }
  };

  y -= 20;
  page.drawText(TITLE, {
    x: MARGIN,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= LINE_HEIGHT * 2;

  drawSection("Executive Summary", sections.executiveSummary, true);
  drawSection("Event Timeline", sections.eventTimeline, false);
  drawSection("Load Curtailment Summary", sections.curtailmentSummary, false);
  drawSection(
    "Remote Disconnect Verification (SB 6)",
    sections.remoteDisconnectVerification,
    false
  );
  drawSection("Attestation", sections.attestation, false);

  return doc.save();
}
