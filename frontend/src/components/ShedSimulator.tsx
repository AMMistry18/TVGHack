"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "";

interface SimResult {
  current_draw_mw: number;
  post_shed_draw_mw: number;
  mw_shed: number;
  deployments_affected: string[];
  pods_scaled_down: number;
  shed_percentage: number;
  savings_per_hour: number;
  compliant_with_ercot: boolean;
}

const DEPLOYMENTS = [
  { name: "data-preprocessing-pipeline", threshold: 200, type: "cpu-batch" },
  { name: "stable-diffusion-batch", threshold: 500, type: "gpu-training" },
  { name: "llama4-training-job", threshold: 1000, type: "gpu-training" },
  { name: "ml-hyperparameter-sweep", threshold: 1000, type: "gpu-training" },
  { name: "embedding-api", threshold: 3000, type: "gpu-inference" },
  { name: "llm-inference-serving", threshold: 5000, type: "gpu-inference" },
];

export default function ShedSimulator() {
  const [price, setPrice] = useState(500);
  const [sim, setSim] = useState<SimResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSim = useCallback(async (p: number) => {
    try {
      const r = await fetch(`${API_BASE}/api/metrics/shed-simulation?price=${p}`);
      if (r.ok) setSim(await r.json());
    } catch { /* offline */ }
  }, []);

  const handleChange = (val: number) => {
    setPrice(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSim(val), 150);
  };

  useEffect(() => {
    fetchSim(price);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  return (
    <div className="grid-card p-5 h-full">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
        Shed Simulator — What-If
      </h3>

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-500">Grid Price</span>
          <span className="text-white font-black text-lg tabular-nums">${price.toLocaleString()}<span className="text-gray-500 text-xs font-normal">/MWh</span></span>
        </div>
        <input
          type="range" min={0} max={10000} step={50} value={price}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #10b981 0%, #f59e0b 30%, #ef4444 70%, #dc2626 100%)` }}
        />
        <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
          <span>$0</span><span>$2,500</span><span>$5,000</span><span>$7,500</span><span>$10,000</span>
        </div>
      </div>

      {sim && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div className="bg-gray-800/50 rounded-lg p-2">
              <div className="text-lg font-black text-red-400 tabular-nums">{sim.mw_shed.toFixed(1)}</div>
              <div className="text-[9px] text-gray-500 uppercase">MW Shed</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <div className="text-lg font-black text-emerald-400 tabular-nums">{fmt(sim.savings_per_hour)}</div>
              <div className="text-[9px] text-gray-500 uppercase">Savings/hr</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <div className="text-lg font-black text-cyan-400 tabular-nums">{sim.pods_scaled_down}</div>
              <div className="text-[9px] text-gray-500 uppercase">Pods Down</div>
            </div>
          </div>

          <div className="space-y-1">
            {DEPLOYMENTS.map((d) => {
              const active = sim.deployments_affected.includes(d.name);
              return (
                <div key={d.name} className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${active ? "bg-red-500/15 text-red-300" : "bg-gray-800/30 text-gray-500"}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-red-500" : "bg-gray-700"}`} />
                  <span className="flex-1 truncate font-mono">{d.name}</span>
                  <span className="text-[9px] tabular-nums">${d.threshold.toLocaleString()}</span>
                  <span className={`text-[9px] font-bold ${active ? "text-red-400" : "text-gray-600"}`}>
                    {active ? "SHED" : "OK"}
                  </span>
                </div>
              );
            })}
          </div>

          {sim.compliant_with_ercot && (
            <div className="mt-3 text-center text-[10px] text-emerald-400 bg-emerald-500/10 rounded py-1">
              ERCOT DR Compliant ({sim.shed_percentage.toFixed(0)}% reduction)
            </div>
          )}
        </>
      )}
    </div>
  );
}
