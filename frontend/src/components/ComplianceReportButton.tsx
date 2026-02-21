"use client";

import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ERCOTData, ComputeData, FinancialData, ActionLogEntry } from "@/lib/simulation";

interface Props {
  logs: ActionLogEntry[];
  ercot: ERCOTData;
  compute: ComputeData;
  financial: FinancialData;
  baseUrl?: string;
}

function serializeForReport(
  logs: ActionLogEntry[],
  ercot: ERCOTData,
  compute: ComputeData,
  financial: FinancialData
) {
  return {
    eventLogs: logs.map((l) => ({
      ...l,
      timestamp:
        typeof l.timestamp === "string"
          ? l.timestamp
          : (l.timestamp instanceof Date ? l.timestamp : new Date(l.timestamp)).toISOString(),
    })),
    ercot: {
      ...ercot,
      timestamp:
        typeof ercot.timestamp === "string"
          ? ercot.timestamp
          : (ercot.timestamp instanceof Date ? ercot.timestamp : new Date(ercot.timestamp)).toISOString(),
    },
    compute,
    financial,
  };
}

export default function ComplianceReportButton({
  logs,
  ercot,
  compute,
  financial,
  baseUrl = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/api/compliance/report`
        : "/api/compliance/report";
      const body = serializeForReport(logs, ercot, compute, financial);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Report failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 border-blue-500/50 bg-blue-500/10 font-bold text-xs text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/70 transition-all duration-300 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">
          {loading ? "Generating report..." : "Generate SB 6 Audit Report"}
        </span>
        <span className="sm:hidden">{loading ? "..." : "SB 6 Report"}</span>
      </button>
      {error && (
        <span className="text-[10px] text-red-400 max-w-[200px] text-right">
          {error}
        </span>
      )}
    </div>
  );
}
