"use client";

import { Zap, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn, getStatusColor, getStatusBg } from "@/lib/utils";
import type { ERCOTData } from "@/lib/simulation";

interface Props {
  data: ERCOTData;
}

export default function GridPriceGauge({ data }: Props) {
  const { lmpPrice, gridStatus, eeaLevel, frequency, reserveMargin } = data;

  const pricePercent = Math.min((lmpPrice / 5000) * 100, 100);

  const arcColor =
    gridStatus === "emergency"
      ? "#ef4444"
      : gridStatus === "scarcity"
      ? "#f97316"
      : gridStatus === "elevated"
      ? "#f59e0b"
      : "#10b981";

  const radius = 80;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (pricePercent / 100) * circumference;

  return (
    <div className="grid-card p-5 lg:p-6 h-full flex flex-col">
      <div className="mb-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          ERCOT Real-Time LMP
        </h3>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border",
            getStatusBg(gridStatus)
          )}
        >
          {gridStatus === "emergency" ? (
            <ShieldAlert className="w-3 h-3" />
          ) : gridStatus === "scarcity" || gridStatus === "elevated" ? (
            <AlertTriangle className="w-3 h-3" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          <span className={getStatusColor(gridStatus)}>
            {gridStatus.toUpperCase()}
          </span>
          {eeaLevel > 0 && (
            <span className="text-[9px] opacity-80">EEA{eeaLevel}</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center flex-1">
        <div className="relative w-full max-w-[220px]">
          <svg viewBox="0 0 200 120" className="w-full h-auto">
            <path
              d="M 10 110 A 80 80 0 0 1 190 110"
              fill="none"
              stroke="#1f2937"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 10 110 A 80 80 0 0 1 190 110"
              fill="none"
              stroke={arcColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
              style={{
                filter: `drop-shadow(0 0 8px ${arcColor}40)`,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-16">
            <span
              className={cn(
                "text-4xl font-black tabular-nums tracking-tight",
                getStatusColor(gridStatus)
              )}
            >
              ${lmpPrice.toFixed(0)}
            </span>
            <span className="text-xs text-gray-500 mt-0.5">/MWh</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-800">
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Frequency
          </div>
          <div
            className={cn(
              "text-sm font-bold tabular-nums mt-0.5",
              Math.abs(frequency - 60) > 0.03
                ? "text-amber-400"
                : "text-emerald-400"
            )}
          >
            {frequency.toFixed(3)} Hz
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Reserve
          </div>
          <div
            className={cn(
              "text-sm font-bold tabular-nums mt-0.5",
              reserveMargin < 10
                ? "text-red-400"
                : reserveMargin < 20
                ? "text-amber-400"
                : "text-emerald-400"
            )}
          >
            {reserveMargin.toFixed(1)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            EEA Level
          </div>
          <div
            className={cn(
              "text-sm font-bold mt-0.5",
              eeaLevel >= 3
                ? "text-red-400"
                : eeaLevel >= 1
                ? "text-amber-400"
                : "text-emerald-400"
            )}
          >
            {eeaLevel === 0 ? "None" : `Level ${eeaLevel}`}
          </div>
        </div>
      </div>
    </div>
  );
}
