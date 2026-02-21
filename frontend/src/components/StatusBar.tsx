"use client";

import { useCallback, useEffect, useState } from "react";

const getApiUrl = (): string => {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return ""; // same-origin; use next.config rewrites to proxy to backend
  }
  return "http://localhost:8000";
};

const getWsUrl = (): string => {
  const base =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
      : "http://localhost:8000";
  return base.replace(/^http/, "ws") + "/ws/live";
};

export type AppState = {
  current_price?: number;
  is_spike_active?: boolean;
  spike_end_time?: string | null;
  load_shed_active?: boolean;
  last_event_id?: string | null;
};

export default function StatusBar() {
  const [state, setState] = useState<AppState | null>(null);
  const [mode, setMode] = useState<"WS CONNECTED" | "POLLING" | "OFF">("OFF");
  const [error, setError] = useState<string | null>(null);

  const fetchCurrent = useCallback(async () => {
    try {
      const base = getApiUrl();
      const url = base ? `${base}/api/grid/current` : "/api/grid/current";
      const r = await fetch(url, { credentials: "omit" });
      if (r.ok) {
        const data = await r.json();
        setState({
          current_price: data.current_price ?? data.price_mwh,
          is_spike_active: undefined,
          spike_end_time: undefined,
          load_shed_active: data.load_shed_active,
          last_event_id: undefined,
        });
        setError(null);
      } else {
        setError("API error");
      }
    } catch (e) {
      const msg =
        e instanceof TypeError && e.message.includes("fetch")
          ? "API unavailable (start backend on :8000?)"
          : String(e);
      setError(msg);
    }
  }, []);

  useEffect(() => {
    const wsUrl = getWsUrl();
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const tryWs = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setMode("WS CONNECTED");
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data as string) as AppState;
            setState(data);
            setError(null);
          } catch (_) {
            // ignore
          }
        };
        ws.onerror = () => {
          setMode("POLLING");
          ws?.close();
          ws = null;
        };
        ws.onclose = () => {
          if (mode !== "POLLING") setMode("POLLING");
          ws = null;
          pollTimer = setInterval(fetchCurrent, 3000);
        };
      } catch (_) {
        setMode("POLLING");
        pollTimer = setInterval(fetchCurrent, 3000);
      }
    };

    tryWs();

    return () => {
      ws?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [fetchCurrent]);

  useEffect(() => {
    if (mode === "POLLING") {
      fetchCurrent();
      const t = setInterval(fetchCurrent, 3000);
      return () => clearInterval(t);
    }
  }, [mode, fetchCurrent]);

  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 text-xs border-b border-gray-800 bg-gray-900/50"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <span
        title="Connection mode"
        className="font-semibold text-gray-400"
      >
        {mode}
      </span>
      {state != null && (
        <>
          <span className="text-gray-500">
            Price: <span className="text-emerald-400">${state.current_price ?? "—"}</span>/MWh
          </span>
          {state.load_shed_active && (
            <span className="text-red-400">Load shed active</span>
          )}
        </>
      )}
      {error && <span className="text-red-400 truncate max-w-[200px]">{error}</span>}
    </div>
  );
}
