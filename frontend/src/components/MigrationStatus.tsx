"use client";

import { Cloud, ArrowRightLeft, Clock, DollarSign, Server, Wifi } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { MigrationData } from "@/lib/simulation";

interface Props {
  migration: MigrationData;
}

const statusLabels = {
  idle: { label: "Idle", color: "text-gray-500", bg: "bg-gray-500/10", dot: "bg-gray-500" },
  migrating: { label: "Migrating", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-400" },
  active: { label: "Active", color: "text-cyan-400", bg: "bg-cyan-500/10", dot: "bg-cyan-400" },
  repatriating: { label: "Repatriating", color: "text-blue-400", bg: "bg-blue-500/10", dot: "bg-blue-400" },
};

export default function MigrationStatus({ migration }: Props) {
  const { migratedPods, migratedMW, remoteRegion, remoteProvider, migrationLatencyMs, cloudSpendPerHour, accumulatedCloudSpend, status } = migration;
  const config = statusLabels[status];
  const isActive = status !== "idle";

  return (
    <div className={cn(
      "grid-card p-5 lg:p-6 h-full transition-all duration-500",
      isActive ? "border-cyan-500/30" : ""
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cloud className={cn("w-4 h-4", isActive ? "text-cyan-400" : "text-gray-500")} />
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Cross-Grid Migration
          </h3>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold", config.bg)}>
          {status === "migrating" && (
            <span className="relative flex h-1.5 w-1.5">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", config.dot)} />
              <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", config.dot)} />
            </span>
          )}
          <span className={config.color}>{config.label}</span>
        </div>
      </div>

      {/* Route visualization */}
      <div className={cn(
        "rounded-lg px-3 py-3 mb-4",
        isActive ? "bg-cyan-500/5 border border-cyan-500/20" : "bg-gray-800/30 border border-gray-800"
      )}>
        <div className="flex items-center justify-between text-xs">
          <div className="text-center">
            <Server className={cn("w-4 h-4 mx-auto mb-1", isActive ? "text-gray-400" : "text-gray-500")} />
            <div className="font-bold text-gray-300">ERCOT</div>
            <div className="text-[10px] text-gray-500">Local</div>
          </div>
          <div className="flex-1 mx-3">
            <div className={cn(
              "flex items-center justify-center gap-1",
              isActive ? "text-cyan-400" : "text-gray-700"
            )}>
              <div className={cn(
                "h-px flex-1",
                isActive ? "bg-gradient-to-r from-gray-700 to-cyan-500" : "bg-gray-800"
              )} />
              <ArrowRightLeft className={cn("w-3.5 h-3.5 shrink-0", isActive && "animate-pulse")} />
              <div className={cn(
                "h-px flex-1",
                isActive ? "bg-gradient-to-l from-gray-700 to-cyan-500" : "bg-gray-800"
              )} />
            </div>
            {isActive && migrationLatencyMs > 0 && (
              <div className="text-center text-[9px] text-gray-500 mt-0.5">
                {migrationLatencyMs}ms latency
              </div>
            )}
          </div>
          <div className="text-center">
            <Cloud className={cn("w-4 h-4 mx-auto mb-1", isActive ? "text-cyan-400" : "text-gray-500")} />
            <div className={cn("font-bold", isActive ? "text-cyan-400" : "text-gray-500")}>{remoteRegion}</div>
            <div className="text-[10px] text-gray-500">{remoteProvider}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/30 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Migrated</div>
          <div className={cn("text-lg font-black tabular-nums", isActive ? "text-cyan-400" : "text-gray-600")}>
            {migratedPods.toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-500">pods ({migratedMW} MW)</div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Cloud $/hr</div>
          <div className={cn("text-lg font-black tabular-nums", isActive ? "text-amber-400" : "text-gray-600")}>
            {formatCurrency(cloudSpendPerHour)}
          </div>
          <div className="text-[10px] text-gray-500">on {remoteProvider}</div>
        </div>
      </div>

      {accumulatedCloudSpend > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-[10px]">
          <span className="flex items-center gap-1 text-gray-400">
            <DollarSign className="w-3 h-3" />
            Session cloud spend
          </span>
          <span className="text-amber-400 font-bold tabular-nums">{formatCurrency(accumulatedCloudSpend)}</span>
        </div>
      )}
    </div>
  );
}
