"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, Shield, Banknote, Cloud } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { FinancialData, ERCOTData } from "@/lib/simulation";

interface Props {
  financial: FinancialData;
  ercot: ERCOTData;
}

export default function FinancialView({ financial }: Props) {
  const { avoidedCost, demandResponseRevenue, cloudSpend, netSavings, criticalUptime, savingsHistory, peakPriceToday, avgPriceToday } = financial;

  return (
    <div className="grid-card p-5 lg:p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Financial Alpha
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <TrendingUp className="w-3.5 h-3.5" />
          Net Savings: <strong className={cn(netSavings >= 0 ? "text-emerald-400" : "text-red-400")}>{formatCurrency(Math.abs(netSavings))}</strong>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="p-1 bg-emerald-500/20 rounded-md">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-medium">
              Avoided Cost
            </span>
          </div>
          <div className="text-xl font-black text-emerald-400 tabular-nums">
            {formatCurrency(avoidedCost)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            vs. spot price
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="p-1 bg-blue-500/20 rounded-md">
              <Banknote className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-[10px] text-blue-400/70 uppercase tracking-wider font-medium">
              DR Revenue
            </span>
          </div>
          <div className="text-xl font-black text-blue-400 tabular-nums">
            {formatCurrency(demandResponseRevenue)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            ERCOT credits
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="p-1 bg-amber-500/20 rounded-md">
              <Cloud className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[10px] text-amber-400/70 uppercase tracking-wider font-medium">
              Cloud Spend
            </span>
          </div>
          <div className={cn("text-xl font-black tabular-nums", cloudSpend > 0 ? "text-amber-400" : "text-gray-600")}>
            {formatCurrency(cloudSpend)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            PJM burst cost
          </div>
        </div>

        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="p-1 bg-violet-500/20 rounded-md">
              <Shield className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-[10px] text-violet-400/70 uppercase tracking-wider font-medium">
              Critical SLO
            </span>
          </div>
          <div className="text-xl font-black text-violet-400 tabular-nums">
            {criticalUptime}%
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            uptime maintained
          </div>
        </div>
      </div>

      <div className="h-[140px] lg:h-[160px] xl:h-[200px] -ml-2 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={savingsHistory.slice(-15)} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCurrency(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === "avoided" ? "Avoided Cost" : name === "revenue" ? "DR Revenue" : "Cloud Cost",
              ]}
            />
            <Bar dataKey="avoided" fill="#10b981" radius={[2, 2, 0, 0]} />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            <Bar dataKey="cloudCost" fill="#f59e0b" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
          <span className="text-xs text-gray-400">Peak LMP Today</span>
          <span className={cn(
            "text-sm font-bold tabular-nums",
            peakPriceToday > 1000 ? "text-red-400" : "text-gray-200"
          )}>
            ${peakPriceToday.toFixed(0)}/MWh
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
          <span className="text-xs text-gray-400">Avg LMP Today</span>
          <span className="text-sm font-bold text-gray-200 tabular-nums">
            ${avgPriceToday.toFixed(0)}/MWh
          </span>
        </div>
      </div>
    </div>
  );
}
