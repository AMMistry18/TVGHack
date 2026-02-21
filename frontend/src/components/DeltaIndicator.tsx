"use client";

import { Activity, ArrowDown, Cpu, Pause, Zap, BatteryCharging } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  shedReadyMW: number;
  totalLoadMW: number;
  criticalLoadMW: number;
  deferredLoadMW: number;
  activePods: number;
  pausedPods: number;
  totalPods: number;
  gridStatus: string;
}

export default function DeltaIndicator({
  shedReadyMW,
  totalLoadMW,
  criticalLoadMW,
  deferredLoadMW,
  activePods,
  pausedPods,
  totalPods,
  gridStatus,
}: Props) {
  const readinessPercent = Math.round((shedReadyMW / totalLoadMW) * 100);
  const criticalPercent = Math.round((criticalLoadMW / totalLoadMW) * 100);
  const deferredPercent = 100 - criticalPercent;

  const tier =
    gridStatus === "emergency"
      ? { label: "Tier 3", desc: "Full shed + battery backup", color: "text-red-400", bg: "bg-red-500/15" }
      : gridStatus === "scarcity"
      ? { label: "Tier 2", desc: "Pause + burst-to-cloud", color: "text-orange-400", bg: "bg-orange-500/15" }
      : gridStatus === "elevated"
      ? { label: "Tier 1", desc: "Checkpoint & pre-stage", color: "text-amber-400", bg: "bg-amber-500/15" }
      : { label: "Standby", desc: "All systems nominal", color: "text-emerald-400", bg: "bg-emerald-500/15" };

  return (
    <div className={cn(
      "grid-card p-5 lg:p-6 h-full border-2 transition-all duration-700 flex flex-col",
      gridStatus === "emergency"
        ? "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
        : gridStatus === "scarcity"
        ? "border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.1)]"
        : gridStatus === "elevated"
        ? "border-amber-500/20"
        : "border-gray-800"
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className={cn(
          "w-4 h-4",
          gridStatus === "emergency" ? "text-red-400 animate-pulse" : "text-emerald-400"
        )} />
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Response Readiness
        </h3>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <div className={cn(
          "text-4xl font-black tabular-nums leading-none",
          gridStatus === "emergency"
            ? "text-red-400"
            : gridStatus === "scarcity"
            ? "text-orange-400"
            : "text-emerald-400"
        )}>
          {shedReadyMW}
        </div>
        <div className="text-gray-500 text-sm mb-0.5">
          MW sheddable
        </div>
      </div>

      {/* Stacked load bar */}
      <div className="relative h-2.5 bg-gray-800 rounded-full overflow-hidden mb-1.5 flex">
        <div
          className="h-full bg-blue-500 transition-all duration-700"
          style={{ width: `${criticalPercent}%` }}
        />
        <div
          className={cn(
            "h-full transition-all duration-700",
            gridStatus === "emergency"
              ? "bg-red-500/60"
              : gridStatus === "scarcity"
              ? "bg-orange-500/60"
              : "bg-emerald-500/60"
          )}
          style={{ width: `${deferredPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] mb-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Critical {criticalLoadMW} MW
          </span>
          <span className={cn("flex items-center gap-1", gridStatus === "emergency" ? "text-red-400" : gridStatus === "scarcity" ? "text-orange-400" : "text-emerald-400")}>
            <span className={cn("w-1.5 h-1.5 rounded-full", gridStatus === "emergency" ? "bg-red-500" : gridStatus === "scarcity" ? "bg-orange-500" : "bg-emerald-500")} />
            Defer {deferredLoadMW} MW
          </span>
        </div>
        <span className="text-gray-500">{readinessPercent}%</span>
      </div>

      {/* Protocol tier */}
      <div className={cn("rounded-lg px-3 py-2.5 mb-4", tier.bg)}>
        <div className="flex items-center gap-2 mb-0.5">
          <BatteryCharging className={cn("w-3.5 h-3.5", tier.color)} />
          <span className={cn("text-xs font-bold", tier.color)}>{tier.label}</span>
        </div>
        <div className="text-[10px] text-gray-400">{tier.desc}</div>
      </div>

      {/* Pod counts + response time */}
      <div className="mt-auto grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 text-[10px]">
          <Cpu className="w-3 h-3 text-emerald-400" />
          <span className="text-gray-400">Active</span>
          <span className="text-gray-200 font-bold tabular-nums ml-auto">{activePods.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <Pause className={cn("w-3 h-3", pausedPods > 0 ? "text-amber-400" : "text-gray-600")} />
          <span className="text-gray-400">Paused</span>
          <span className={cn("font-bold tabular-nums ml-auto", pausedPods > 0 ? "text-amber-400" : "text-gray-500")}>{pausedPods.toLocaleString()}</span>
        </div>
        <div className="col-span-2 flex items-center justify-between text-[10px] pt-2 border-t border-gray-800/50">
          <span className="flex items-center gap-1 text-gray-500">
            <ArrowDown className="w-3 h-3" />
            Response: &lt;500ms
          </span>
          <span className="text-gray-500 tabular-nums">{totalPods.toLocaleString()} total pods</span>
        </div>
      </div>
    </div>
  );
}
