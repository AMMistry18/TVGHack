"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Cpu, Server, Pause, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComputeData } from "@/lib/simulation";
import { getComputeHistory } from "@/lib/simulation";

interface Props {
  data: ComputeData;
}

export default function ComputeLoadChart({ data }: Props) {
  const history = getComputeHistory();
  const { totalLoadMW, activePods, pausedPods, migratedPods, shedReadyMW, remoteLoadMW } = data;

  return (
    <div className="grid-card p-5 lg:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Compute Load
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Critical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            Deferred
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            Remote
          </span>
        </div>
      </div>

      <div className="h-[160px] lg:h-[180px] xl:h-[220px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="criticalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="deferredGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="remoteGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
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
              unit=" MW"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => [
                `${value} MW`,
                name === "critical" ? "Critical (local)" : name === "deferred" ? "Deferred (local)" : "Remote (PJM)",
              ]}
            />
            <Area
              type="monotone"
              dataKey="critical"
              stackId="1"
              stroke="#3b82f6"
              fill="url(#criticalGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="deferred"
              stackId="1"
              stroke="#8b5cf6"
              fill="url(#deferredGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="remote"
              stroke="#06b6d4"
              fill="url(#remoteGrad)"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-gray-800">
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Local
          </div>
          <div className="text-sm font-bold text-white tabular-nums mt-0.5 flex items-center justify-center gap-1">
            <Server className="w-3.5 h-3.5 text-gray-500" />
            {totalLoadMW} MW
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Remote
          </div>
          <div className={cn(
            "text-sm font-bold tabular-nums mt-0.5 flex items-center justify-center gap-1",
            remoteLoadMW > 0 ? "text-cyan-400" : "text-gray-500"
          )}>
            <Cloud className="w-3.5 h-3.5" />
            {remoteLoadMW} MW
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Active
          </div>
          <div className="text-sm font-bold text-emerald-400 tabular-nums mt-0.5 flex items-center justify-center gap-1">
            <Cpu className="w-3.5 h-3.5" />
            {activePods.toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Migrated
          </div>
          <div className={cn(
            "text-sm font-bold tabular-nums mt-0.5",
            migratedPods > 0 ? "text-cyan-400" : "text-gray-500"
          )}>
            {migratedPods.toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Paused
          </div>
          <div className={cn(
            "text-sm font-bold tabular-nums mt-0.5 flex items-center justify-center gap-1",
            pausedPods > 0 ? "text-amber-400" : "text-gray-500"
          )}>
            <Pause className="w-3.5 h-3.5" />
            {pausedPods.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
