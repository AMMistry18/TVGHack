export type GridStatus = "normal" | "elevated" | "scarcity" | "emergency";
export type EEALevel = 0 | 1 | 2 | 3;

export interface ERCOTData {
  lmpPrice: number;
  timestamp: Date;
  gridStatus: GridStatus;
  eeaLevel: EEALevel;
  frequency: number;
  totalDemand: number;
  totalCapacity: number;
  reserveMargin: number;
}

export interface MigrationData {
  migratedPods: number;
  migratedMW: number;
  remoteRegion: string;
  remoteProvider: string;
  migrationLatencyMs: number;
  cloudSpendPerHour: number;
  accumulatedCloudSpend: number;
  status: "idle" | "migrating" | "active" | "repatriating";
}

export interface ComputeData {
  totalLoadMW: number;
  criticalLoadMW: number;
  deferredLoadMW: number;
  remoteLoadMW: number;
  activePods: number;
  pausedPods: number;
  migratedPods: number;
  totalPods: number;
  shedReadyMW: number;
  namespaces: NamespaceLoad[];
  migration: MigrationData;
}

export interface NamespaceLoad {
  name: string;
  priority: "critical" | "medium" | "low";
  pods: number;
  remotePods: number;
  loadMW: number;
  remoteLoadMW: number;
  status: "running" | "draining" | "paused" | "migrated";
}

export interface ActionLogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "warning" | "action" | "success" | "critical";
  source: "ERCOT" | "StargateOS" | "K8s Controller" | "Financial" | "System" | "Migration";
  message: string;
}

export interface FinancialData {
  avoidedCost: number;
  demandResponseRevenue: number;
  cloudSpend: number;
  netSavings: number;
  criticalUptime: number;
  savingsHistory: { time: string; avoided: number; revenue: number; cloudCost: number }[];
  peakPriceToday: number;
  avgPriceToday: number;
}

let simulationTime = new Date();
let pricePhase = 0;
let spikeActive = false;
let spikeTick = 0;
let spikeTotalTicks = 0;
let previousGridStatus: GridStatus = "normal";
let accumulatedSavings = 0;
let accumulatedDR = 0;
let accumulatedCloudSpend = 0;

const LMP_HISTORY: { time: Date; price: number }[] = [];
const COMPUTE_HISTORY: { time: Date; critical: number; deferred: number; remote: number }[] = [];
const ACTION_LOG: ActionLogEntry[] = [];

function addLog(entry: Omit<ActionLogEntry, "id" | "timestamp">) {
  ACTION_LOG.unshift({
    ...entry,
    id: crypto.randomUUID?.() ?? Math.random().toString(36),
    timestamp: new Date(simulationTime),
  });
  if (ACTION_LOG.length > 100) ACTION_LOG.pop();
}

function getBasePrice(): number {
  const hour = simulationTime.getHours();
  if (hour >= 14 && hour <= 18) return 80 + Math.random() * 40;
  if (hour >= 6 && hour <= 22) return 30 + Math.random() * 30;
  return 15 + Math.random() * 15;
}

function shouldTriggerSpike(): boolean {
  if (spikeActive) return false;
  return Math.random() < 0.03;
}

export function tickSimulation(): {
  ercot: ERCOTData;
  compute: ComputeData;
  financial: FinancialData;
  logs: ActionLogEntry[];
} {
  simulationTime = new Date();
  pricePhase += 0.1;

  if (shouldTriggerSpike() && !spikeActive) {
    spikeActive = true;
    spikeTick = 0;
    spikeTotalTicks = 12 + Math.floor(Math.random() * 6);
    addLog({ type: "warning", source: "ERCOT", message: "SCED interval detecting abnormal pricing. Grid stress rising." });
  }

  let lmpPrice: number;
  if (spikeActive) {
    const progress = spikeTick / spikeTotalTicks;
    // Bell curve: ramps up through elevated → scarcity → emergency, then back down
    const curve = Math.sin(progress * Math.PI);
    // Map curve 0→1→0 to price: base → peak → base
    // curve ~0.0-0.3 = elevated ($600-1500), ~0.3-0.7 = scarcity ($1500-3000), ~0.7-1.0 = emergency ($3000-5000)
    const peakPrice = 4000 + Math.random() * 1000;
    lmpPrice = 50 + curve * peakPrice + Math.random() * 100;

    spikeTick++;
    if (spikeTick >= spikeTotalTicks) {
      spikeActive = false;
      spikeTick = 0;
    }
  } else {
    lmpPrice = getBasePrice() + Math.sin(pricePhase) * 10;
  }

  lmpPrice = Math.round(lmpPrice * 100) / 100;

  let gridStatus: GridStatus = "normal";
  let eeaLevel: EEALevel = 0;
  if (lmpPrice > 3000) { gridStatus = "emergency"; eeaLevel = 3; }
  else if (lmpPrice > 1500) { gridStatus = "scarcity"; eeaLevel = 2; }
  else if (lmpPrice > 500) { gridStatus = "elevated"; eeaLevel = 1; }

  // Log tier transitions with clear explanations
  if (gridStatus !== previousGridStatus) {
    if (gridStatus === "elevated" && previousGridStatus === "normal") {
      addLog({ type: "info", source: "ERCOT", message: `⚠ TIER 1 — ELEVATED: LMP crossed $500/MWh ($${lmpPrice.toFixed(0)}). Grid stress detected.` });
      addLog({ type: "action", source: "StargateOS", message: "Tier 1 response: Pre-staging checkpoint saves on non-critical namespaces. Pre-warming migration targets in PJM-East." });
      addLog({ type: "action", source: "K8s Controller", message: "Pausing 450 low-priority batch pods. Holding critical and medium workloads." });
    } else if (gridStatus === "scarcity" && previousGridStatus === "elevated") {
      addLog({ type: "warning", source: "ERCOT", message: `⚠ TIER 2 — SCARCITY: LMP crossed $1,500/MWh ($${lmpPrice.toFixed(0)}). EEA Level 2 issued.` });
      addLog({ type: "action", source: "StargateOS", message: "Tier 2 response: Initiating cross-grid migration. Moving latency-insensitive workloads to PJM-East (AWS us-east-1)." });
      addLog({ type: "action", source: "Migration", message: "Migrating llama-training (600 pods) and batch-inference (200 pods) to remote cluster. Saving checkpoints first." });
      addLog({ type: "action", source: "K8s Controller", message: "Draining model-eval namespace. Local deferred load dropping to ~10MW." });
    } else if (gridStatus === "emergency") {
      addLog({ type: "critical", source: "ERCOT", message: `🚨 TIER 3 — EMERGENCY: LMP crossed $3,000/MWh ($${lmpPrice.toFixed(0)}). EEA Level 3 — full curtailment.` });
      addLog({ type: "action", source: "StargateOS", message: "Tier 3 response: Full load shed protocol. Only critical workloads remain on local grid." });
      addLog({ type: "action", source: "K8s Controller", message: "All non-critical pods drained. Analytics and model-eval paused. 1,100 pods offline locally." });
      addLog({ type: "action", source: "Migration", message: "700 pods active on PJM-East (us-east-1). 20MW shifted off ERCOT grid." });
      addLog({ type: "action", source: "StargateOS", message: "Signaling on-site battery backup for 45MW critical load (customer-api, real-time-inference)." });
    } else if (gridStatus === "scarcity" && previousGridStatus === "emergency") {
      addLog({ type: "success", source: "ERCOT", message: `↓ De-escalating to TIER 2 — SCARCITY: LMP falling below $3,000/MWh ($${lmpPrice.toFixed(0)}). EEA downgraded to Level 2.` });
      addLog({ type: "action", source: "StargateOS", message: "Releasing battery backup. Resuming medium-priority namespaces locally. Migration still active." });
    } else if (gridStatus === "elevated" && previousGridStatus === "scarcity") {
      addLog({ type: "success", source: "ERCOT", message: `↓ De-escalating to TIER 1 — ELEVATED: LMP falling below $1,500/MWh ($${lmpPrice.toFixed(0)}). EEA Level 1.` });
      addLog({ type: "action", source: "Migration", message: "Initiating workload repatriation from PJM-East (us-east-1) back to ERCOT local cluster." });
      addLog({ type: "action", source: "K8s Controller", message: "Re-scheduling deferred pods locally. Repatriation ETA: ~60s." });
    } else if (gridStatus === "normal" && previousGridStatus !== "normal") {
      addLog({ type: "success", source: "ERCOT", message: `✓ ALL CLEAR: LMP returned below $500/MWh ($${lmpPrice.toFixed(0)}). Grid conditions normal.` });
      addLog({ type: "success", source: "StargateOS", message: "All tiers disengaged. Full local workload restored. Repatriation complete." });
      addLog({ type: "info", source: "Financial", message: `Spike event concluded. Savings accrued: $${Math.round(accumulatedSavings).toLocaleString()} avoided cost, $${Math.round(accumulatedDR).toLocaleString()} DR revenue.` });
    }
    previousGridStatus = gridStatus;
  }

  const totalCapacity = 85000;
  const baseDemand = 62000 + Math.sin(pricePhase * 0.3) * 5000;
  const totalDemand = spikeActive ? baseDemand + 8000 : baseDemand;
  const reserveMargin = ((totalCapacity - totalDemand) / totalCapacity) * 100;
  const frequency = 60 + (Math.random() - 0.5) * (spikeActive ? 0.08 : 0.02);

  LMP_HISTORY.push({ time: new Date(simulationTime), price: lmpPrice });
  if (LMP_HISTORY.length > 60) LMP_HISTORY.shift();

  const baseCritical = 45;
  const baseDeferred = 55;
  let criticalLoadMW = baseCritical + Math.random() * 2;
  let deferredLoadMW: number;
  let remoteLoadMW = 0;
  let pausedPods = 0;
  let migratedPods = 0;
  const totalPods = 2400;
  let migrationStatus: MigrationData["status"] = "idle";
  let migrationLatency = 0;

  if (gridStatus === "emergency") {
    deferredLoadMW = 2 + Math.random() * 3;
    remoteLoadMW = 18 + Math.random() * 3;
    pausedPods = 1100;
    migratedPods = 700;
    migrationStatus = "active";
    migrationLatency = 1200 + Math.random() * 800;
  } else if (gridStatus === "scarcity") {
    deferredLoadMW = 8 + Math.random() * 4;
    remoteLoadMW = 25 + Math.random() * 5;
    pausedPods = 400;
    migratedPods = 800;
    migrationStatus = "migrating";
    migrationLatency = 800 + Math.random() * 600;
  } else if (gridStatus === "elevated") {
    deferredLoadMW = 35 + Math.random() * 5;
    pausedPods = 450;
    migrationStatus = "idle";
  } else {
    deferredLoadMW = baseDeferred + Math.random() * 3;
    migrationStatus = "idle";
  }

  const totalLoadMW = criticalLoadMW + deferredLoadMW;
  const activePods = totalPods - pausedPods - migratedPods;
  const shedReadyMW = deferredLoadMW;

  const cloudCostPerMWh = 85;
  if (migratedPods > 0) {
    accumulatedCloudSpend += (remoteLoadMW * cloudCostPerMWh) / 720;
  }

  COMPUTE_HISTORY.push({ time: new Date(simulationTime), critical: criticalLoadMW, deferred: deferredLoadMW, remote: remoteLoadMW });
  if (COMPUTE_HISTORY.length > 60) COMPUTE_HISTORY.shift();

  const namespaces: NamespaceLoad[] = [
    { name: "customer-api", priority: "critical", pods: 120, remotePods: 0, loadMW: 15, remoteLoadMW: 0, status: "running" },
    { name: "real-time-inference", priority: "critical", pods: 200, remotePods: 0, loadMW: 30, remoteLoadMW: 0, status: "running" },
    {
      name: "llama-training", priority: "low",
      pods: gridStatus === "emergency" ? 0 : gridStatus === "scarcity" ? 0 : 800,
      remotePods: gridStatus === "emergency" ? 500 : gridStatus === "scarcity" ? 600 : 0,
      loadMW: gridStatus === "emergency" ? 0 : gridStatus === "scarcity" ? 0 : 25,
      remoteLoadMW: gridStatus === "emergency" ? 15 : gridStatus === "scarcity" ? 18 : 0,
      status: gridStatus === "emergency" ? "migrated" : gridStatus === "scarcity" ? "migrated" : "running",
    },
    {
      name: "batch-inference", priority: "low",
      pods: gridStatus === "emergency" ? 0 : gridStatus === "scarcity" ? 50 : 600,
      remotePods: gridStatus === "emergency" ? 200 : gridStatus === "scarcity" ? 200 : 0,
      loadMW: gridStatus === "emergency" ? 0 : gridStatus === "scarcity" ? 3 : 18,
      remoteLoadMW: gridStatus === "emergency" ? 3 : gridStatus === "scarcity" ? 7 : 0,
      status: gridStatus === "emergency" ? "migrated" : gridStatus === "scarcity" ? "draining" : "running",
    },
    {
      name: "analytics", priority: "medium",
      pods: gridStatus === "emergency" ? 0 : 400,
      remotePods: 0,
      loadMW: gridStatus === "emergency" ? 0 : 8,
      remoteLoadMW: 0,
      status: gridStatus === "emergency" ? "paused" : "running",
    },
    {
      name: "model-eval", priority: "medium",
      pods: gridStatus === "emergency" || gridStatus === "scarcity" ? 80 : 280,
      remotePods: 0,
      loadMW: gridStatus === "emergency" || gridStatus === "scarcity" ? 2 : 6,
      remoteLoadMW: 0,
      status: gridStatus === "scarcity" ? "draining" : gridStatus === "emergency" ? "paused" : "running",
    },
  ];

  if (spikeActive) {
    const shedMW = baseDeferred - deferredLoadMW;
    const savingsThisTick = (shedMW * lmpPrice) / 12;
    accumulatedSavings += savingsThisTick;
    accumulatedDR += shedMW * 15;
  }

  const savingsHistory = COMPUTE_HISTORY.slice(-30).map((h, i) => ({
    time: h.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    avoided: Math.round(accumulatedSavings * (i / 30)),
    revenue: Math.round(accumulatedDR * (i / 30)),
    cloudCost: Math.round(accumulatedCloudSpend * (i / 30)),
  }));

  const prices = LMP_HISTORY.map(h => h.price);

  const migration: MigrationData = {
    migratedPods,
    migratedMW: Math.round(remoteLoadMW * 10) / 10,
    remoteRegion: "PJM-East",
    remoteProvider: "AWS us-east-1",
    migrationLatencyMs: Math.round(migrationLatency),
    cloudSpendPerHour: Math.round(remoteLoadMW * cloudCostPerMWh),
    accumulatedCloudSpend: Math.round(accumulatedCloudSpend),
    status: migrationStatus,
  };

  return {
    ercot: {
      lmpPrice,
      timestamp: new Date(simulationTime),
      gridStatus,
      eeaLevel,
      frequency: Math.round(frequency * 1000) / 1000,
      totalDemand: Math.round(totalDemand),
      totalCapacity,
      reserveMargin: Math.round(reserveMargin * 10) / 10,
    },
    compute: {
      totalLoadMW: Math.round(totalLoadMW * 10) / 10,
      criticalLoadMW: Math.round(criticalLoadMW * 10) / 10,
      deferredLoadMW: Math.round(deferredLoadMW * 10) / 10,
      remoteLoadMW: Math.round(remoteLoadMW * 10) / 10,
      activePods,
      pausedPods,
      migratedPods,
      totalPods,
      shedReadyMW: Math.round(shedReadyMW * 10) / 10,
      namespaces,
      migration,
    },
    financial: {
      avoidedCost: Math.round(accumulatedSavings),
      demandResponseRevenue: Math.round(accumulatedDR),
      cloudSpend: Math.round(accumulatedCloudSpend),
      netSavings: Math.round(accumulatedSavings + accumulatedDR - accumulatedCloudSpend),
      criticalUptime: 100,
      savingsHistory,
      peakPriceToday: Math.round(Math.max(...prices) * 100) / 100,
      avgPriceToday: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
    },
    logs: ACTION_LOG.slice(0, 50),
  };
}

export function getLMPHistory() {
  return LMP_HISTORY.map(h => ({
    time: h.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    price: h.price,
  }));
}

export function getComputeHistory() {
  return COMPUTE_HISTORY.map(h => ({
    time: h.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    critical: Math.round(h.critical * 10) / 10,
    deferred: Math.round(h.deferred * 10) / 10,
    remote: Math.round(h.remote * 10) / 10,
  }));
}

export function triggerManualShed() {
  spikeActive = true;
  spikeTick = 0;
  spikeTotalTicks = 10;
  addLog({ type: "critical", source: "System", message: "MANUAL GRID SHED initiated by operator. Forcing emergency spike." });
}

export function triggerDemoSpike() {
  if (spikeActive) return;
  spikeActive = true;
  spikeTick = 0;
  spikeTotalTicks = 18;
  addLog({ type: "info", source: "System", message: "[DEMO] Simulated grid stress event starting. Watch the dashboard escalate through Tier 1 → Tier 2 → Tier 3 and back." });
}
