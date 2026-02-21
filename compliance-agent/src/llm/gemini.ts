import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ReportRequestBody, ReportSections } from "../types.js";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompts.js";

const SECTION_HEADERS = [
  "## Executive Summary",
  "## Event Timeline",
  "## Load Curtailment Summary",
  "## Remote Disconnect Verification (SB 6)",
  "## Attestation",
] as const;

const SECTION_KEYS: (keyof ReportSections)[] = [
  "executiveSummary",
  "eventTimeline",
  "curtailmentSummary",
  "remoteDisconnectVerification",
  "attestation",
];

function parseMarkdownSections(text: string): ReportSections {
  const sections: Partial<ReportSections> = {};
  let currentKey: keyof ReportSections | null = null;
  let currentContent: string[] = [];

  const flush = () => {
    if (currentKey) {
      sections[currentKey] = currentContent.join("\n").trim();
      currentContent = [];
    }
  };

  const lines = text.split("\n");
  for (const line of lines) {
    const headerIndex = SECTION_HEADERS.findIndex((h) =>
      line.trim().startsWith(h)
    );
    if (headerIndex >= 0) {
      flush();
      currentKey = SECTION_KEYS[headerIndex];
      const afterHeader = line.replace(SECTION_HEADERS[headerIndex], "").trim();
      if (afterHeader) currentContent.push(afterHeader);
    } else if (currentKey) {
      currentContent.push(line);
    }
  }
  flush();

  for (const key of SECTION_KEYS) {
    if (!sections[key]) sections[key] = "";
  }
  return sections as ReportSections;
}

export async function generateReportSections(
  payload: ReportRequestBody,
  apiKey: string
): Promise<ReportSections> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const userPrompt = buildUserPrompt(payload);
  const combined =
    SYSTEM_PROMPT +
    "\n\n---\n\nUse the following data to generate the report:\n\n" +
    userPrompt;
  const result = await model.generateContent(combined);
  const response = result.response;
  const text = response.text();
  if (!text) {
    throw new Error("Gemini returned no text");
  }
  return parseMarkdownSections(text);
}
