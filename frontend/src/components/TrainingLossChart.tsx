"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "";

export interface TrainingStatus {
  status: string;
  current_epoch: number;
  current_loss: number;
  last_checkpoint: string;
  checkpoint_reason: string;
  training_time_seconds: number;
  resumed_from_emergency: boolean;
}

function buildLossCurveData(status: TrainingStatus | null): { epoch: number; loss: number | null }[] {
  const data: { epoch: number; loss: number | null }[] = [];
  const maxEpoch = status ? Math.max(status.current_epoch + 50, 400) : 350;
  const step = Math.max(1, Math.floor(maxEpoch / 100));
  const emergencyStart =
    status?.resumed_from_emergency ? Math.max(0, status.current_epoch - 55) : -1;
  const emergencyEnd = status?.resumed_from_emergency ? status.current_epoch : -1;
  const lossAtResume = status?.current_loss ?? 6.8;
  const lossStart = 10;

  for (let epoch = 0; epoch <= maxEpoch; epoch += step) {
    if (emergencyStart >= 0 && epoch > emergencyStart && epoch < emergencyEnd) {
      data.push({ epoch, loss: null });
      continue;
    }
    let loss: number;
    if (emergencyStart >= 0 && epoch <= emergencyStart) {
      const t = emergencyStart > 0 ? epoch / emergencyStart : 1;
      loss = lossStart - t * (lossStart - lossAtResume);
    } else if (emergencyEnd >= 0 && epoch >= emergencyEnd) {
      const postEpochs = maxEpoch - emergencyEnd;
      const t = postEpochs > 0 ? (epoch - emergencyEnd) / postEpochs : 1;
      loss = lossAtResume - t * (lossAtResume * 0.15);
    } else {
      loss = lossStart - (epoch / maxEpoch) * (lossStart - lossAtResume);
    }
    data.push({ epoch, loss: Math.round(loss * 1000) / 1000 });
  }
  return data;
}

export default function TrainingLossChart() {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const url = API_BASE ? `${API_BASE}/api/demo/training-status` : "/api/demo/training-status";
        const r = await fetch(url, { credentials: "omit" });
        if (r.ok) {
          const data = await r.json();
          setStatus(data);
          setError(null);
        }
      } catch (e) {
        setError(String(e));
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const chartData = useMemo(() => buildLossCurveData(status), [status]);
  const emergencyStart =
    status?.resumed_from_emergency ? Math.max(0, status.current_epoch - 60) : null;
  const emergencyEnd = status?.resumed_from_emergency ? status.current_epoch : null;

  return (
    <div className="grid-card p-5 lg:p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Training Loss — Survives Grid Emergency
        </h3>
        {status && (
          <div className="text-xs text-gray-500">
            Epoch <strong className="text-white">{status.current_epoch}</strong>
            {" · "}
            Loss <strong className="text-emerald-400">{status.current_loss.toFixed(4)}</strong>
            {status.resumed_from_emergency && (
              <span className="ml-1 text-amber-400">· Resumed from checkpoint</span>
            )}
          </div>
        )}
      </div>
      {error && (
        <div className="text-red-400 text-xs mb-2">API: {error}</div>
      )}
      <div className="h-[180px] lg:h-[200px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="epoch"
              type="number"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              domain={["dataMin", "dataMax"]}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => (value != null ? [value.toFixed(4), "Loss"] : [null, "Loss"])}
              labelFormatter={(epoch) => `Epoch ${epoch}`}
            />
            {emergencyStart != null && emergencyEnd != null && (
              <>
                <ReferenceArea
                  x1={emergencyStart}
                  x2={emergencyEnd}
                  strokeOpacity={0.3}
                  fill="#ef4444"
                  fillOpacity={0.2}
                  label={{ value: "⚡ GRID EMERGENCY", fill: "#f87171", fontSize: 10, position: "insideTopLeft" }}
                />
                <ReferenceLine
                  x={emergencyEnd}
                  stroke="#10b981"
                  strokeDasharray="5 5"
                  label={{ value: "✅ RESUMED FROM CHECKPOINT", fill: "#10b981", fontSize: 10, position: "insideTopRight" }}
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="loss"
              stroke="#10b981"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 3, fill: "#10b981" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
