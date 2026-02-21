import { Router, type Request, type Response } from "express";
import { validateReportBody } from "../validate.js";
import { generateReportSections } from "../llm/gemini.js";
import { buildPdf } from "../pdf/generator.js";

const router = Router();

router.post("/report", async (req: Request, res: Response) => {
  try {
    if (!validateReportBody(req.body)) {
      res.status(400).json({ error: "Invalid request: eventLogs, ercot, compute, financial required" });
      return;
    }
    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(502).json({
        error: "Compliance agent misconfigured: missing GOOGLE_GENERATIVE_AI_API_KEY",
      });
      return;
    }
    const sections = await generateReportSections(req.body, apiKey);
    const pdfBytes = await buildPdf(sections);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `SB6-Audit-Report-${date}.pdf`;
    res
      .setHeader("Content-Type", "application/pdf")
      .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
      .send(Buffer.from(pdfBytes));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Report generation failed";
    res.status(502).json({ error: message });
  }
});

export default router;
