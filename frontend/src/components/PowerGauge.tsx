"use client";

import { useState, useEffect } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";

const API_BASE = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "";

interface PowerBreakdown {
  total_facility_mw: number;
  total_it_load_mw: number;
  cooling_overhead_mw: number;
  pdu_loss_mw: number;
  pue: number;
  by_criticality: Record<string, { mw: number; percentage: number }>;
}

export default function PowerGauge() {
  const [data, setData] = useState<PowerBreakdown | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/metrics/power`);
        if (r.ok) setData(await r.json());
      } catch { /* backend may be offline */ }
    };
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  }, []);

  const total = data?.total_facility_mw ?? 0;
  const capacity = 100;
  const pct = Math.min((total / capacity) * 100, 100);
  const color = pct > 80 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#10b981";

  const flexMw = (data?.by_criticality?.["flexible"]?.mw ?? 0) + (data?.by_criticality?.["semi-flexible"]?.mw ?? 0);
  const critMw = data?.by_criticality?.["critical"]?.mw ?? 0;
  const semiMw = data?.by_criticality?.["semi-flexible"]?.mw ?? 0;

  const radialData = [{ name: "Power", value: pct, fill: color }];

  return (
    <div className="grid-card p-5 h-full">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
        Facility Power Draw
      </h3>

      <div className="flex items-center justify-center h-[140px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="50%"
            innerRadius="70%" outerRadius="95%"
            startAngle={210} endAngle={-30}
            data={radialData}
            barSize={14}
          >
            <RadialBar background={{ fill: "#1f2937" }} dataKey="value" cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tabular-nums" style={{ color }}>
            {total > 0 ? total.toFixed(1) : "—"}
          </span>
          <span className="text-[10px] text-gray-500 uppercase">MW / {capacity}</span>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <BarRow label="Flexible" mw={flexMw - semiMw} total={total} color="bg-emerald-500" />
        <BarRow label="Semi-flex" mw={semiMw} total={total} color="bg-amber-500" />
        <BarRow label="Critical" mw={critMw} total={total} color="bg-red-500" />
      </div>

      {data && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-gray-500">
          <div>IT<br /><span className="text-gray-300 font-semibold">{data.total_it_load_mw.toFixed(1)}</span></div>
          <div>Cool<br /><span className="text-gray-300 font-semibold">{data.cooling_overhead_mw.toFixed(1)}</span></div>
          <div>PUE<br /><span className="text-gray-300 font-semibold">{data.pue}</span></div>
        </div>
      )}
    </div>
  );
}

function BarRow({ label, mw, total, color }: { label: string; mw: number; total: number; color: string }) {
  const pct = total > 0 ? (mw / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-gray-500 w-16 text-right">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-400 w-12 tabular-nums">{mw.toFixed(1)}</span>
    </div>
  );
}
