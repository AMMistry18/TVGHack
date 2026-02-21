import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type RGB } from "pdf-lib";
import type { ReportSections } from "../types.js";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 60;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const MAX_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const COLORS = {
  navy: rgb(0.08, 0.12, 0.22),
  darkBlue: rgb(0.12, 0.17, 0.3),
  accentBlue: rgb(0.18, 0.42, 0.78),
  accentCyan: rgb(0.04, 0.71, 0.65),
  darkGray: rgb(0.15, 0.15, 0.18),
  bodyGray: rgb(0.22, 0.22, 0.25),
  lightGray: rgb(0.55, 0.55, 0.6),
  ruleGray: rgb(0.85, 0.85, 0.88),
  bgGray: rgb(0.95, 0.96, 0.97),
  white: rgb(1, 1, 1),
  red: rgb(0.85, 0.18, 0.18),
};

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

interface DocState {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  pageNum: number;
  font: PDFFont;
  fontBold: PDFFont;
  totalPages: number;
}

function drawFooter(state: DocState) {
  const { page, font, pageNum } = state;
  const footerY = MARGIN_BOTTOM - 28;

  page.drawLine({
    start: { x: MARGIN_LEFT, y: footerY + 14 },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: footerY + 14 },
    thickness: 0.5,
    color: COLORS.ruleGray,
  });

  page.drawText("StargateOS — Automated Compliance Report", {
    x: MARGIN_LEFT,
    y: footerY,
    size: 7,
    font,
    color: COLORS.lightGray,
  });

  const pageText = `Page ${pageNum}`;
  const pageTextWidth = font.widthOfTextAtSize(pageText, 7);
  page.drawText(pageText, {
    x: PAGE_WIDTH - MARGIN_RIGHT - pageTextWidth,
    y: footerY,
    size: 7,
    font,
    color: COLORS.lightGray,
  });
}

function newPage(state: DocState): void {
  drawFooter(state);
  state.page = state.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  state.pageNum++;
  state.y = PAGE_HEIGHT - MARGIN_TOP;
}

function ensureSpace(state: DocState, needed: number): void {
  if (state.y - needed < MARGIN_BOTTOM) {
    newPage(state);
  }
}

function drawCoverPage(state: DocState) {
  const { page, font, fontBold } = state;

  // Full-width navy header band
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 200,
    width: PAGE_WIDTH,
    height: 200,
    color: COLORS.navy,
  });

  // Accent stripe
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 206,
    width: PAGE_WIDTH,
    height: 6,
    color: COLORS.accentCyan,
  });

  // Logo text
  page.drawText("Stargate", {
    x: MARGIN_LEFT,
    y: PAGE_HEIGHT - 70,
    size: 36,
    font: fontBold,
    color: COLORS.white,
  });
  page.drawText("OS", {
    x: MARGIN_LEFT + 175,
    y: PAGE_HEIGHT - 70,
    size: 36,
    font,
    color: rgb(0.6, 0.7, 0.85),
  });

  // Subtitle
  page.drawText("Grid-Aware Compute · ERCOT Texas", {
    x: MARGIN_LEFT,
    y: PAGE_HEIGHT - 95,
    size: 10,
    font,
    color: rgb(0.5, 0.6, 0.75),
  });

  // Report title
  page.drawText("SB 6 / GRID Act", {
    x: MARGIN_LEFT,
    y: PAGE_HEIGHT - 140,
    size: 28,
    font: fontBold,
    color: COLORS.white,
  });
  page.drawText("Compliance Audit Report", {
    x: MARGIN_LEFT,
    y: PAGE_HEIGHT - 170,
    size: 28,
    font: fontBold,
    color: COLORS.white,
  });

  // Report metadata box
  const metaY = PAGE_HEIGHT - 260;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  page.drawRectangle({
    x: MARGIN_LEFT,
    y: metaY - 80,
    width: MAX_WIDTH,
    height: 80,
    color: COLORS.bgGray,
    borderColor: COLORS.ruleGray,
    borderWidth: 0.5,
  });

  const metaFields = [
    ["Report Date", dateStr],
    ["Report Time", timeStr],
    ["Jurisdiction", "ERCOT — Texas Interconnection"],
    ["Regulatory Basis", "Senate Bill 6 (SB 6) / GRID Act"],
  ];

  let metaFieldY = metaY - 18;
  for (const [label, value] of metaFields) {
    page.drawText(`${label}:`, {
      x: MARGIN_LEFT + 15,
      y: metaFieldY,
      size: 8.5,
      font: fontBold,
      color: COLORS.lightGray,
    });
    page.drawText(value, {
      x: MARGIN_LEFT + 130,
      y: metaFieldY,
      size: 8.5,
      font,
      color: COLORS.darkGray,
    });
    metaFieldY -= 16;
  }

  // Confidentiality notice
  const noticeY = metaY - 110;
  page.drawText("CONFIDENTIAL", {
    x: MARGIN_LEFT,
    y: noticeY,
    size: 8,
    font: fontBold,
    color: COLORS.red,
  });
  page.drawText(
    "This report is system-generated from operational telemetry and ERCOT market data. It is intended for regulatory compliance purposes.",
    {
      x: MARGIN_LEFT,
      y: noticeY - 14,
      size: 7.5,
      font,
      color: COLORS.lightGray,
    }
  );

  state.y = noticeY - 50;
}

function drawSectionHeader(state: DocState, title: string, sectionNum: number) {
  ensureSpace(state, 50);

  const { page, fontBold } = state;

  // Section divider line
  if (sectionNum > 1) {
    state.y -= 8;
    page.drawLine({
      start: { x: MARGIN_LEFT, y: state.y },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: state.y },
      thickness: 0.5,
      color: COLORS.ruleGray,
    });
    state.y -= 18;
  }

  // Accent bar
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: state.y - 2,
    width: 4,
    height: 16,
    color: COLORS.accentBlue,
  });

  // Section number badge
  const numText = `${sectionNum}`;
  page.drawText(numText, {
    x: MARGIN_LEFT + 12,
    y: state.y,
    size: 9,
    font: fontBold,
    color: COLORS.accentBlue,
  });

  // Section title
  page.drawText(title.toUpperCase(), {
    x: MARGIN_LEFT + 26,
    y: state.y,
    size: 11,
    font: fontBold,
    color: COLORS.navy,
  });

  state.y -= 22;
}

function drawBodyText(state: DocState, text: string) {
  const { font } = state;
  const lines = wrapText(text, MAX_WIDTH, font, 9.5);
  const lineHeight = 13.5;

  for (const line of lines) {
    ensureSpace(state, lineHeight + 4);

    if (line === "") {
      state.y -= lineHeight * 0.6;
      continue;
    }

    // Detect bullet-style lines from the LLM
    const isBullet = /^[-–•]\s/.test(line) || /^\d+[.)]\s/.test(line);

    state.page.drawText(line, {
      x: MARGIN_LEFT + (isBullet ? 10 : 0),
      y: state.y,
      size: 9.5,
      font: isBullet ? font : font,
      color: COLORS.bodyGray,
    });
    state.y -= lineHeight;
  }
}

function drawHighlightBox(state: DocState, text: string, accentColor: RGB) {
  const { font, fontBold } = state;
  const lines = wrapText(text, MAX_WIDTH - 30, font, 9);
  const boxHeight = Math.max(lines.length * 13 + 20, 40);

  ensureSpace(state, boxHeight + 10);

  // Background
  state.page.drawRectangle({
    x: MARGIN_LEFT,
    y: state.y - boxHeight + 12,
    width: MAX_WIDTH,
    height: boxHeight,
    color: COLORS.bgGray,
    borderColor: COLORS.ruleGray,
    borderWidth: 0.5,
  });

  // Left accent bar
  state.page.drawRectangle({
    x: MARGIN_LEFT,
    y: state.y - boxHeight + 12,
    width: 3,
    height: boxHeight,
    color: accentColor,
  });

  let textY = state.y - 2;
  for (const line of lines) {
    state.page.drawText(line, {
      x: MARGIN_LEFT + 15,
      y: textY,
      size: 9,
      font,
      color: COLORS.darkGray,
    });
    textY -= 13;
  }

  state.y -= boxHeight + 6;
}

export async function buildPdf(sections: ReportSections): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const state: DocState = {
    doc,
    page,
    y: PAGE_HEIGHT - MARGIN_TOP,
    pageNum: 1,
    font,
    fontBold,
    totalPages: 0,
  };

  drawCoverPage(state);

  // Start content on a new page
  newPage(state);

  // Section 1: Executive Summary
  drawSectionHeader(state, "Executive Summary", 1);
  drawHighlightBox(state, sections.executiveSummary, COLORS.accentCyan);

  // Section 2: Event Timeline
  drawSectionHeader(state, "Event Timeline", 2);
  drawBodyText(state, sections.eventTimeline);

  // Section 3: Load Curtailment Summary
  state.y -= 6;
  drawSectionHeader(state, "Load Curtailment Summary", 3);
  drawBodyText(state, sections.curtailmentSummary);

  // Section 4: Remote Disconnect Verification
  state.y -= 6;
  drawSectionHeader(state, "Remote Disconnect Verification (SB 6)", 4);
  drawHighlightBox(state, sections.remoteDisconnectVerification, COLORS.accentBlue);

  // Section 5: Attestation
  state.y -= 6;
  drawSectionHeader(state, "Attestation", 5);
  drawHighlightBox(state, sections.attestation, COLORS.navy);

  // Final footer
  drawFooter(state);

  return doc.save();
}
