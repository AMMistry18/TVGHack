import { NextRequest, NextResponse } from "next/server";

const COMPLIANCE_AGENT_URL =
  process.env.COMPLIANCE_AGENT_URL || "http://localhost:4000";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("econnrefused") || msg.includes("fetch failed") || msg.includes("connection"))
      return "Compliance agent unreachable. Start it with: cd compliance-agent && npm run dev (and set GOOGLE_GENERATIVE_AI_API_KEY in compliance-agent/.env)";
    return err.message;
  }
  return "Report generation failed";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${COMPLIANCE_AGENT_URL}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const error = (data as { error?: string }).error || res.statusText || "Report generation failed";
      return NextResponse.json({ error }, { status: res.status });
    }
    const pdf = await res.arrayBuffer();
    const filename =
      res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
      "SB6-Audit-Report.pdf";
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
