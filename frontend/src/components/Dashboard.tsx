"use client";

import { useState, useEffect, useCallback } from "react";
import { tickSimulation, triggerManualShed, triggerDemoSpike } from "@/lib/simulation";
import type { ERCOTData, ComputeData, FinancialData, ActionLogEntry } from "@/lib/simulation";
import Header from "./Header";
import StatusBar from "./StatusBar";
import GridPriceGauge from "./GridPriceGauge";
import ComputeLoadChart from "./ComputeLoadChart";
import LMPChart from "./LMPChart";
import DeltaIndicator from "./DeltaIndicator";
import ActionFeed from "./ActionFeed";
import FinancialView from "./FinancialView";
import NamespaceTable from "./NamespaceTable";
import MigrationStatus from "./MigrationStatus";
import TrainingLossChart from "./TrainingLossChart";
import PowerGauge from "./PowerGauge";
import PowerTimeline from "./PowerTimeline";
import ShedSimulator from "./ShedSimulator";

export default function Dashboard() {
  const [ercot, setErcot] = useState<ERCOTData | null>(null);
  const [compute, setCompute] = useState<ComputeData | null>(null);
  const [financial, setFinancial] = useState<FinancialData | null>(null);
  const [logs, setLogs] = useState<ActionLogEntry[]>([]);

  const refresh = useCallback(() => {
    const data = tickSimulation();
    setErcot(data.ercot);
    setCompute(data.compute);
    setFinancial(data.financial);
    setLogs(data.logs);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!ercot || !compute || !financial) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-emerald-400 text-lg font-bold">
            Initializing StargateOS...
          </div>
          <div className="text-gray-500 text-sm mt-2">
            Connecting to ERCOT Real-Time Market
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <StatusBar />
      <Header
          gridStatus={ercot.gridStatus}
          timestamp={ercot.timestamp}
          onManualShed={triggerManualShed}
          onDemoSpike={triggerDemoSpike}
          logs={logs}
          ercot={ercot}
          compute={compute}
          financial={financial}
        />

      <main className="p-4 md:p-5 lg:p-6 xl:px-8 2xl:px-10 max-w-[2400px] mx-auto">
        <div className="grid grid-cols-12 gap-4 lg:gap-5 xl:gap-6 auto-rows-min">
          {/* Row 1: Power Gauge + Grid Price + Delta + Compute chart */}
          <div className="col-span-12 md:col-span-6 lg:col-span-3 xl:col-span-3">
            <PowerGauge />
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-3 xl:col-span-2">
            <GridPriceGauge data={ercot} />
          </div>
          <div className="col-span-12 lg:col-span-6 xl:col-span-7">
            <ComputeLoadChart data={compute} />
          </div>

          {/* Row 2: Power Timeline + Shed Simulator */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-8">
            <PowerTimeline />
          </div>
          <div className="col-span-12 lg:col-span-4 xl:col-span-4">
            <ShedSimulator />
          </div>

          {/* Row 3: Namespaces + Migration + LMP */}
          <div className="col-span-12 lg:col-span-5 xl:col-span-4">
            <NamespaceTable namespaces={compute.namespaces} />
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-3 xl:col-span-3">
            <MigrationStatus migration={compute.migration} />
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-4 xl:col-span-5">
            <LMPChart data={ercot} />
          </div>

          {/* Row 4: Financial + Action Feed */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-8">
            <FinancialView financial={financial} ercot={ercot} />
          </div>
          <div className="col-span-12 lg:col-span-4 xl:col-span-4">
            <ActionFeed logs={logs} />
          </div>

          {/* Row 5: Training survival — checkpoint/resume during grid emergency */}
          <div className="col-span-12">
            <TrainingLossChart />
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-800 px-6 py-3 text-center text-[10px] text-gray-600">
        StargateOS v0.1.0 &middot; ERCOT RTM Simulation &middot; SB 6 Compliant &middot; Built for Texas Grid
      </footer>
    </div>
  );
}
