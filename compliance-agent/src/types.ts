/** Request body for POST /report — matches frontend simulation data shapes. */

export interface ActionLogEntry {
  id: string;
  timestamp: string; // ISO
  type: "info" | "warning" | "action" | "success" | "critical";
  source: "ERCOT" | "C2G Agent" | "K8s Controller" | "Financial" | "System";
  message: string;
}

export interface ERCOTData {
  lmpPrice: number;
  timestamp: string; // ISO
  gridStatus: "normal" | "elevated" | "scarcity" | "emergency";
  eeaLevel: 0 | 1 | 2 | 3;
  frequency: number;
  totalDemand: number;
  totalCapacity: number;
  reserveMargin: number;
}

export interface NamespaceLoad {
  name: string;
  priority: "critical" | "medium" | "low";
  pods: number;
  loadMW: number;
  status: "running" | "draining" | "paused";
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

export interface FinancialData {
  avoidedCost: number;
  demandResponseRevenue: number;
  criticalUptime: number;
  savingsHistory: { time: string; avoided: number; revenue: number }[];
  peakPriceToday: number;
  avgPriceToday: number;
}

export interface ReportRequestBody {
  eventLogs: ActionLogEntry[];
  ercot: ERCOTData;
  compute: ComputeData;
  financial: FinancialData;
  reportingPeriod?: { start: string; end: string };
}

export interface ReportSections {
  executiveSummary: string;
  eventTimeline: string;
  curtailmentSummary: string;
  remoteDisconnectVerification: string;
  attestation: string;
}
