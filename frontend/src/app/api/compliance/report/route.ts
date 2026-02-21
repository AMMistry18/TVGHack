import { NextRequest, NextResponse } from "next/server";

const COMPLIANCE_AGENT_URL =
  process.env.COMPLIANCE_AGENT_URL || "http://localhost:4000";

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
      return NextResponse.json(
        { error: (data as { error?: string }).error || "Report generation failed" },
        { status: res.status }
      );
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
    const message = err instanceof Error ? err.message : "Report generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
