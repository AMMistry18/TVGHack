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

export interface ComputeData {
  totalLoadMW: number;
  criticalLoadMW: number;
  deferredLoadMW: number;
  activePods: number;
  pausedPods: number;
  totalPods: number;
  shedReadyMW: number;
  namespaces: NamespaceLoad[];
}

export interface NamespaceLoad {
  name: string;
  priority: "critical" | "medium" | "low";
  pods: number;
  loadMW: number;
  status: "running" | "draining" | "paused";
}

export interface ActionLogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "warning" | "action" | "success" | "critical";
  source: "ERCOT" | "C2G Agent" | "K8s Controller" | "Financial" | "System";
  message: string;
}

export interface FinancialData {
  avoidedCost: number;
  demandResponseRevenue: number;
  criticalUptime: number;
  savingsHistory: { time: string; avoided: number; revenue: number }[];
  peakPriceToday: number;
  avgPriceToday: number;
}

let simulationTime = new Date();
let pricePhase = 0;
let spikeActive = false;
let spikeTimer = 0;
let accumulatedSavings = 0;
let accumulatedDR = 0;

const LMP_HISTORY: { time: Date; price: number }[] = [];
const COMPUTE_HISTORY: { time: Date; critical: number; deferred: number }[] = [];
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
    spikeTimer = 8 + Math.floor(Math.random() * 12);
    addLog({ type: "critical", source: "ERCOT", message: `SCED Interval Price Spike detected. Emergency pricing active.` });
  }

  let lmpPrice: number;
  if (spikeActive) {
    spikeTimer--;
    const intensity = Math.sin(spikeTimer * 0.5) * 0.3 + 0.7;
    lmpPrice = 1500 + Math.random() * 3500 * intensity;
    if (spikeTimer <= 0) {
      spikeActive = false;
      addLog({ type: "success", source: "ERCOT", message: "Price spike subsiding. Returning to normal market conditions." });
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
  let pausedPods = 0;
  const totalPods = 2400;

  if (gridStatus === "emergency") {
    deferredLoadMW = 2 + Math.random() * 3;
    pausedPods = 1800;
    if (!ACTION_LOG.find(l => l.message.includes("EEA3") && Date.now() - l.timestamp.getTime() < 10000)) {
      addLog({ type: "critical", source: "C2G Agent", message: `EEA3 ACTIVATED: Initiating full load shed protocol.` });
      addLog({ type: "action", source: "K8s Controller", message: `Draining ${pausedPods} pods across namespaces: llama-training, batch-inference, analytics.` });
      addLog({ type: "action", source: "C2G Agent", message: `Signaling on-site battery systems to assume ${Math.round(criticalLoadMW)}MW critical load.` });
    }
  } else if (gridStatus === "scarcity") {
    deferredLoadMW = 15 + Math.random() * 5;
    pausedPods = 1200;
    if (!ACTION_LOG.find(l => l.message.includes("High-Price") && Date.now() - l.timestamp.getTime() < 10000)) {
      addLog({ type: "warning", source: "C2G Agent", message: `Initiating "High-Price" protocol. LMP at $${lmpPrice.toFixed(0)}/MWh.` });
      addLog({ type: "action", source: "K8s Controller", message: `Pausing ${pausedPods} low-priority pods. Saving training checkpoints.` });
      addLog({ type: "action", source: "C2G Agent", message: `Triggering burst-to-cloud migration for latency-insensitive workloads.` });
    }
  } else if (gridStatus === "elevated") {
    deferredLoadMW = 35 + Math.random() * 5;
    pausedPods = 450;
    if (!ACTION_LOG.find(l => l.message.includes("Elevated") && Date.now() - l.timestamp.getTime() < 15000)) {
      addLog({ type: "info", source: "C2G Agent", message: `Elevated pricing detected ($${lmpPrice.toFixed(0)}/MWh). Pre-staging checkpoint saves.` });
    }
  } else {
    deferredLoadMW = baseDeferred + Math.random() * 3;
  }

  const totalLoadMW = criticalLoadMW + deferredLoadMW;
  const activePods = totalPods - pausedPods;
  const shedReadyMW = deferredLoadMW;

  COMPUTE_HISTORY.push({ time: new Date(simulationTime), critical: criticalLoadMW, deferred: deferredLoadMW });
  if (COMPUTE_HISTORY.length > 60) COMPUTE_HISTORY.shift();

  const namespaces: NamespaceLoad[] = [
    { name: "customer-api", priority: "critical", pods: 120, loadMW: 15, status: "running" },
    { name: "real-time-inference", priority: "critical", pods: 200, loadMW: 30, status: "running" },
    { name: "llama-training", priority: "low", pods: gridStatus === "emergency" ? 0 : gridStatus === "scarcity" ? 100 : 800, loadMW: gridStatus === "emergency" ? 0 : gridStatus === "scarcity" ? 5 : 25, status: gridStatus === "emergency" ? "paused" : gridStatus === "scarcity" ? "draining" : "running" },
    { name: "batch-inference", priority: "low", pods: gridStatus === "emergency" ? 0 : gridStatus === "scarcity" ? 50 : 600, loadMW: gridStatus === "emergency" ? 0 : gridStatus === "scarcity" ? 3 : 18, status: gridStatus === "emergency" ? "paused" : gridStatus === "scarcity" ? "draining" : "running" },
    { name: "analytics", priority: "medium", pods: gridStatus === "emergency" ? 0 : 400, loadMW: gridStatus === "emergency" ? 0 : 8, status: gridStatus === "emergency" ? "paused" : "running" },
    { name: "model-eval", priority: "medium", pods: gridStatus === "emergency" || gridStatus === "scarcity" ? 80 : 280, loadMW: gridStatus === "emergency" || gridStatus === "scarcity" ? 2 : 6, status: gridStatus === "scarcity" ? "draining" : gridStatus === "emergency" ? "paused" : "running" },
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
  }));

  const prices = LMP_HISTORY.map(h => h.price);

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
      activePods,
      pausedPods,
      totalPods,
      shedReadyMW: Math.round(shedReadyMW * 10) / 10,
      namespaces,
    },
    financial: {
      avoidedCost: Math.round(accumulatedSavings),
      demandResponseRevenue: Math.round(accumulatedDR),
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
  }));
}

export function triggerManualShed() {
  spikeActive = true;
  spikeTimer = 6;
  addLog({ type: "critical", source: "System", message: "MANUAL GRID SHED initiated by operator." });
  addLog({ type: "action", source: "C2G Agent", message: "Emergency protocol engaged. Draining all non-critical workloads." });
}
