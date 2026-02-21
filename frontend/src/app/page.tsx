"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  Zap,
  Server,
  Shield,
  BarChart3,
  ArrowRight,
  Activity,
  Cloud,
  DollarSign,
} from "lucide-react";

function AnimatedGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const nodes: { x: number; y: number; vx: number; vy: number; r: number; pulse: number }[] = [];
    const nodeCount = 40;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 1,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    const draw = (time: number) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.02;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            const alpha = (1 - dist / 160) * 0.15;
            ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        const glow = 0.3 + Math.sin(n.pulse) * 0.2;
        ctx.fillStyle = `rgba(16, 185, 129, ${glow})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}

const features = [
  {
    icon: Zap,
    title: "Real-Time ERCOT Monitoring",
    desc: "Continuous polling of Locational Marginal Pricing and Emergency Energy Alert levels from the ERCOT Real-Time Market.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
  },
  {
    icon: Server,
    title: "Kubernetes Drain Orchestration",
    desc: "Tiered workload management — pause non-critical pods, migrate deferrable compute, protect mission-critical services.",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/20",
  },
  {
    icon: Cloud,
    title: "Cross-Grid Migration",
    desc: "Burst latency-insensitive workloads to PJM-East (AWS us-east-1) during Texas grid stress, capturing price arbitrage.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
  },
  {
    icon: Shield,
    title: "SB 6 / GRID Act Compliance",
    desc: "Automated audit trail generation with LLM-powered compliance reports proving remote disconnect capability.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
  },
  {
    icon: DollarSign,
    title: "Financial Optimization",
    desc: "Track avoided costs, demand response revenue, and cloud spend in real-time. Maximize savings during price spikes.",
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
  },
  {
    icon: BarChart3,
    title: "Live Operational Dashboard",
    desc: "Full-stack visibility into grid state, compute load, namespace health, migration status, and financial impact.",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    border: "border-violet-400/20",
  },
];

const tiers = [
  { level: "Tier 1", label: "Non-Critical", desc: "Pause batch jobs & dev workloads", color: "bg-amber-400", width: "w-1/3" },
  { level: "Tier 2", label: "Movable", desc: "Migrate deferred compute cross-grid", color: "bg-orange-400", width: "w-2/3" },
  { level: "Tier 3", label: "Critical Only", desc: "Shed all non-essential, battery backup", color: "bg-red-400", width: "w-full" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-emerald-400">Stargate</span>
              <span className="text-gray-300">OS</span>
            </span>
          </div>
          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all"
          >
            Open Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 lg:pt-44 lg:pb-36 overflow-hidden">
        <AnimatedGrid />

        {/* Radial glow behind hero */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/60 border border-gray-700/50 text-xs text-gray-400 mb-8">
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            Built for the Texas Grid &middot; SB 6 Compliant
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            <span className="text-gray-100">Automated Grid Response</span>
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              for Data Centers
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            StargateOS sits between ERCOT&apos;s Real-Time Market and your
            Kubernetes workload orchestrator. When the grid spikes, it
            automatically curtails, migrates, and protects — so you stay
            compliant and profitable.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="group relative flex items-center gap-3 px-8 py-4 rounded-xl bg-emerald-500 text-gray-950 font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:bg-emerald-400 transition-all duration-300"
            >
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="https://capitol.texas.gov/BillLookup/History.aspx?LegSess=87R&Bill=SB6"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-4 rounded-xl border border-gray-700 text-gray-300 font-medium hover:bg-gray-800/50 transition-all"
            >
              <Shield className="w-4 h-4 text-gray-500" />
              Read SB 6
            </a>
          </div>
        </div>
      </section>

      {/* How it works strip */}
      <section className="border-y border-gray-800/60 bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
          <p className="text-center text-xs font-semibold tracking-[0.2em] uppercase text-emerald-400/70 mb-3">
            How it works
          </p>
          <h2 className="text-center text-3xl lg:text-4xl font-bold mb-4">
            Price Signal In, Load Curtailment Out
          </h2>
          <p className="text-center text-gray-500 max-w-xl mx-auto mb-14">
            Three-tier automated response based on real-time grid conditions.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((t) => (
              <div
                key={t.level}
                className="relative p-6 rounded-2xl border border-gray-800 bg-gray-900/50 hover:border-gray-700 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className={`w-2.5 h-2.5 rounded-full ${t.color}`} />
                  <span className="text-sm font-bold text-gray-300">{t.level}</span>
                  <span className="text-sm text-gray-500">{t.label}</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed mb-5">{t.desc}</p>
                <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                  <div className={`h-full rounded-full ${t.color} ${t.width} transition-all duration-700 opacity-60 group-hover:opacity-100`} />
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline diagram */}
          <div className="mt-14 flex items-center justify-center gap-0">
            {[
              { label: "ERCOT RTM", sub: "Price signal" },
              { label: "StargateOS", sub: "Decision engine" },
              { label: "K8s Controller", sub: "Workload drain" },
              { label: "PJM-East", sub: "Burst target" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center w-28 sm:w-36">
                  <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm mb-2">
                    {i + 1}
                  </div>
                  <span className="text-xs font-semibold text-gray-200 text-center">{step.label}</span>
                  <span className="text-[10px] text-gray-500 text-center">{step.sub}</span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-gray-600 -mx-1 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
        <p className="text-center text-xs font-semibold tracking-[0.2em] uppercase text-emerald-400/70 mb-3">
          Platform Capabilities
        </p>
        <h2 className="text-center text-3xl lg:text-4xl font-bold mb-14">
          Everything You Need to Stay Grid-Ready
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className={`p-6 rounded-2xl border ${f.border} ${f.bg} hover:scale-[1.02] transition-transform duration-200`}
            >
              <f.icon className={`w-6 h-6 ${f.color} mb-4`} />
              <h3 className="text-base font-bold text-gray-100 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-800/60 bg-gray-900/20">
        <div className="max-w-3xl mx-auto px-6 py-20 lg:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Simulation Ready
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            See It In Action
          </h2>
          <p className="text-gray-400 mb-10 max-w-lg mx-auto">
            The dashboard runs a full real-time simulation of ERCOT price
            spikes, automated pod draining, cross-grid migration, and financial
            impact tracking.
          </p>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-emerald-500 text-gray-950 font-bold text-xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:bg-emerald-400 transition-all duration-300"
          >
            Launch Dashboard
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/40 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-emerald-500/50" />
            <span>StargateOS v0.1.0</span>
          </div>
          <span>
            ERCOT RTM Simulation &middot; SB 6 / GRID Act Compliant &middot;
            Built for Texas
          </span>
        </div>
      </footer>
    </div>
  );
}
