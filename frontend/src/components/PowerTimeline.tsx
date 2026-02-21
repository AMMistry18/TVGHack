"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, ComposedChart,
} from "recharts";

const API_BASE = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "";

interface TimelinePoint {
  time: string;
  total_mw: number;
  flexible_mw: number;
  critical_mw: number;
  grid_price: number;
  shed_active: boolean;
  mw_shed: number;
}

export default function PowerTimeline() {
  const [data, setData] = useState<TimelinePoint[]>([]);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/metrics/power/timeline?hours=2`);
        if (r.ok) {
          const json = await r.json();
          setData(json.timeline || []);
        }
      } catch { /* backend offline */ }
    };
    fetch_();
    const id = setInterval(fetch_, 10000);
    return () => clearInterval(id);
  }, []);

  if (data.length === 0) {
    return (
      <div className="grid-card p-5 h-full">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Power Draw Timeline
        </h3>
        <div className="flex items-center justify-center h-[200px] text-gray-600 text-sm">
          Collecting power data...
        </div>
      </div>
    );
  }

  return (
    <div className="grid-card p-5 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Power Draw Timeline
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Semi-flex</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Flexible</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Price</span>
        </div>
      </div>

      <div className="h-[200px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="mw" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} domain={[0, 110]} label={{ value: "MW", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 10 }} />
            <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} domain={[0, "auto"]} label={{ value: "$/MWh", angle: 90, position: "insideRight", fill: "#6b7280", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "#9ca3af" }}
              formatter={(val: number, name: string) => {
                if (name === "grid_price") return [`$${val.toFixed(0)}/MWh`, "Price"];
                return [`${val.toFixed(1)} MW`, name === "critical_mw" ? "Critical" : name === "flexible_mw" ? "Flexible" : "Total"];
              }}
            />
            <Area yAxisId="mw" type="monotone" dataKey="critical_mw" stackId="power" fill="#ef4444" fillOpacity={0.6} stroke="#ef4444" strokeWidth={0} />
            <Area yAxisId="mw" type="monotone" dataKey="flexible_mw" stackId="power" fill="#10b981" fillOpacity={0.4} stroke="#10b981" strokeWidth={0} />
            <Line yAxisId="price" type="monotone" dataKey="grid_price" stroke="#22d3ee" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
