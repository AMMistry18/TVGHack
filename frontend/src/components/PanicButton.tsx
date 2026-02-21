"use client";

import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Props {
  onTrigger: () => void;
  gridStatus: string;
}

export default function PanicButton({ onTrigger, gridStatus }: Props) {
  const [confirming, setConfirming] = useState(false);
  const isActive = gridStatus === "scarcity" || gridStatus === "emergency";

  const handleClick = () => {
    if (confirming) {
      onTrigger();
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "relative group flex items-center gap-3 w-full px-6 py-4 rounded-xl border-2 font-bold text-sm transition-all duration-300",
        confirming
          ? "bg-red-600 border-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]"
          : isActive
          ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30 hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
          : "bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-lg transition-colors",
          confirming
            ? "bg-red-700"
            : isActive
            ? "bg-red-500/20"
            : "bg-gray-700"
        )}
      >
        <ShieldAlert
          className={cn(
            "w-5 h-5",
            confirming && "animate-pulse"
          )}
        />
      </div>
      <div className="text-left">
        <div>
          {confirming ? "CONFIRM MANUAL SHED" : "Manual Grid Shed"}
        </div>
        <div
          className={cn(
            "text-[10px] font-normal mt-0.5",
            confirming ? "text-red-200" : "text-gray-500"
          )}
        >
          {confirming
            ? "Click again to activate emergency protocol"
            : "Override automated response"}
        </div>
      </div>
      {isActive && !confirming && (
        <span className="ml-auto relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
      )}
    </button>
  );
}
