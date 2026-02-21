"use client";

import { cn } from "@/lib/utils";
import { Box, CircleDot, CirclePause, CircleSlash, Cloud } from "lucide-react";
import type { NamespaceLoad } from "@/lib/simulation";

interface Props {
  namespaces: NamespaceLoad[];
}

const priorityBadge = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const statusConfig = {
  running: { icon: CircleDot, color: "text-emerald-400", label: "running" },
  draining: { icon: CirclePause, color: "text-amber-400", label: "draining" },
  paused: { icon: CircleSlash, color: "text-red-400", label: "paused" },
  migrated: { icon: Cloud, color: "text-cyan-400", label: "migrated" },
};

export default function NamespaceTable({ namespaces }: Props) {
  return (
    <div className="grid-card p-5 lg:p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Box className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Kubernetes Namespaces
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left py-2 font-medium">Namespace</th>
              <th className="text-center py-2 font-medium">Priority</th>
              <th className="text-center py-2 font-medium">Status</th>
              <th className="text-right py-2 font-medium">Local</th>
              <th className="text-right py-2 font-medium">Remote</th>
              <th className="text-right py-2 font-medium">MW</th>
            </tr>
          </thead>
          <tbody>
            {namespaces.map((ns) => {
              const config = statusConfig[ns.status];
              const StatusIcon = config.icon;
              const hasRemote = ns.remotePods > 0;
              return (
                <tr
                  key={ns.name}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-2.5 font-mono text-gray-200">{ns.name}</td>
                  <td className="py-2.5 text-center">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        priorityBadge[ns.priority]
                      )}
                    >
                      {ns.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className={cn("flex items-center justify-center gap-1", config.color)}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span className="font-medium">{config.label}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-300">
                    {ns.pods.toLocaleString()}
                  </td>
                  <td className={cn(
                    "py-2.5 text-right tabular-nums",
                    hasRemote ? "text-cyan-400" : "text-gray-600"
                  )}>
                    {hasRemote ? ns.remotePods.toLocaleString() : "—"}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-300">
                    {(ns.loadMW + ns.remoteLoadMW).toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {namespaces.some(ns => ns.remotePods > 0) && (
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2 text-[10px] text-cyan-400/70">
          <Cloud className="w-3 h-3" />
          <span>Remote pods running on PJM-East (AWS us-east-1)</span>
        </div>
      )}
    </div>
  );
}
