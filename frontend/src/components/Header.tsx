"use client";

import { Zap, Radio, ShieldAlert } from "lucide-react";
import { cn, getStatusColor, getStatusBg } from "@/lib/utils";
import type { GridStatus } from "@/lib/simulation";
import { useState } from "react";

interface Props {
  gridStatus: GridStatus;
  timestamp: Date;
  onManualShed: () => void;
}

export default function Header({ gridStatus, timestamp, onManualShed }: Props) {
  const [confirming, setConfirming] = useState(false);
  const isActive = gridStatus === "scarcity" || gridStatus === "emergency";

  const handleShed = () => {
    if (confirming) {
      onManualShed();
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <header className="flex items-center justify-between px-4 md:px-6 xl:px-8 2xl:px-10 py-3 lg:py-4 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          gridStatus === "emergency"
            ? "bg-red-500/20"
            : "bg-emerald-500/20"
        )}>
          <Zap className={cn(
            "w-6 h-6",
            gridStatus === "emergency"
              ? "text-red-400"
              : "text-emerald-400"
          )} />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight">
            <span className="text-white">C2G</span>{" "}
            <span className="text-gray-500">Orchestrator</span>
          </h1>
          <div className="text-[10px] text-gray-600 tracking-wider uppercase">
            Compute-to-Grid &middot; ERCOT Texas
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span>Polling: 5s</span>
        </div>
        <div className="hidden sm:block text-xs text-gray-500 tabular-nums">
          {timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
        <div className={cn(
          "hidden lg:block px-3 py-1.5 rounded-lg border text-xs font-bold",
          getStatusBg(gridStatus)
        )}>
          <span className={getStatusColor(gridStatus)}>
            GRID: {gridStatus.toUpperCase()}
          </span>
        </div>

        <button
          onClick={handleShed}
          className={cn(
            "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 font-bold text-xs transition-all duration-300 whitespace-nowrap",
            confirming
              ? "bg-red-600 border-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)]"
              : isActive
              ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30 hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
              : "bg-gray-800/60 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600"
          )}
        >
          <ShieldAlert className={cn("w-4 h-4", confirming && "animate-pulse")} />
          <span className="hidden sm:inline">
            {confirming ? "CONFIRM SHED" : "Manual Shed"}
          </span>
          <span className="sm:hidden">
            {confirming ? "CONFIRM" : "Shed"}
          </span>
          {isActive && !confirming && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
