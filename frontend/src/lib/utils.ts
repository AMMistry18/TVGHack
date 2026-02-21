import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatMW(value: number): string {
  return `${value.toFixed(1)} MW`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "normal": return "text-emerald-400";
    case "elevated": return "text-amber-400";
    case "scarcity": return "text-orange-400";
    case "emergency": return "text-red-400";
    default: return "text-gray-400";
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case "normal": return "bg-emerald-500/20 border-emerald-500/30";
    case "elevated": return "bg-amber-500/20 border-amber-500/30";
    case "scarcity": return "bg-orange-500/20 border-orange-500/30";
    case "emergency": return "bg-red-500/20 border-red-500/30";
    default: return "bg-gray-500/20 border-gray-500/30";
  }
}
