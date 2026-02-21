import type { ReportRequestBody } from "./types.js";

export function validateReportBody(body: unknown): body is ReportRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.eventLogs)) return false;
  if (!b.ercot || typeof b.ercot !== "object") return false;
  if (!b.compute || typeof b.compute !== "object") return false;
  if (!b.financial || typeof b.financial !== "object") return false;
  return true;
}
