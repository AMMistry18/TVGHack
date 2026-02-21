"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { getLMPHistory } from "@/lib/simulation";
import type { ERCOTData } from "@/lib/simulation";

interface Props {
  data: ERCOTData;
}

export default function LMPChart({ data }: Props) {
  const history = getLMPHistory();

  return (
    <div className="grid-card p-5 lg:p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          LMP Price History
        </h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Peak: <strong className="text-white">${data.lmpPrice > 1000 ? data.lmpPrice.toFixed(0) : Math.max(...history.map(h => h.price)).toFixed(0)}</strong>/MWh</span>
        </div>
      </div>

      <div className="h-[120px] lg:h-[140px] xl:h-[160px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="lmpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              domain={[0, "auto"]}
              unit="$"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}/MWh`, "LMP"]}
            />
            <ReferenceLine
              y={1000}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              label={{ value: "$1K Threshold", fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }}
            />
            <ReferenceLine
              y={3000}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{ value: "$3K Emergency", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }}
            />
            <Line
              type="linear"
              dataKey="price"
              stroke="#10b981"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#10b981" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
