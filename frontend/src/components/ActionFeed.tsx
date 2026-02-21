"use client";

import { Terminal, AlertTriangle, Zap, CheckCircle, ShieldAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionLogEntry } from "@/lib/simulation";
import { useRef, useEffect } from "react";

interface Props {
  logs: ActionLogEntry[];
}

const typeConfig = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-400/10" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10" },
  action: { icon: Zap, color: "text-violet-400", bg: "bg-violet-400/10" },
  success: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  critical: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-400/10" },
};

export default function ActionFeed({ logs }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs.length]);

  return (
    <div className="grid-card p-5 lg:p-6 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          StargateOS Feed
        </h3>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] text-emerald-400 font-medium">LIVE</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin space-y-1 font-mono text-xs min-h-[200px] max-h-[50vh] lg:max-h-[40vh]"
      >
        {logs.length === 0 && (
          <div className="text-gray-600 text-center py-8">
            Waiting for grid events...
          </div>
        )}
        {logs.map((log) => {
          const config = typeConfig[log.type];
          const Icon = config.icon;
          return (
            <div
              key={log.id}
              className={cn(
                "flex gap-2 p-2 rounded-lg transition-all duration-300",
                config.bg,
                "hover:bg-gray-800/50"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", config.color)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-gray-500">
                    [{log.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}]
                  </span>
                  <span className={cn("font-bold", config.color)}>
                    {log.source}:
                  </span>
                </div>
                <span className="text-gray-300 break-words">{log.message}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
