"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Snapshot {
  snapshot_date: string;
  portfolio_cumulative_return: number;
  spy_cumulative_return: number;
}

interface PerformanceData {
  snapshots: Snapshot[];
  currentEquity: number | null;
  startingEquity: number;
}

export function PerformanceWidget() {
  const [data, setData] = useState<PerformanceData | null>(null);

  useEffect(() => {
    fetch("/api/performance")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setData(d))
      .catch(() => null);
  }, []);

  if (!data || data.snapshots.length < 2) return null;

  const latest = data.snapshots[data.snapshots.length - 1];
  const first = data.snapshots[0];
  const portfolioReturn = data.currentEquity
    ? ((data.currentEquity - data.startingEquity) / data.startingEquity) * 100
    : latest.portfolio_cumulative_return;
  const spyReturn = latest.spy_cumulative_return;
  const alpha = portfolioReturn - spyReturn;

  const sinceDate = new Date(first.snapshot_date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
  const equity = data.currentEquity ?? data.startingEquity * (1 + portfolioReturn / 100);
  const fmtEquity = equity.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  // Merge live return into snapshots for the chart
  const chartSnapshots: Snapshot[] = [
    ...data.snapshots.slice(0, -1),
    { ...latest, portfolio_cumulative_return: portfolioReturn },
  ];

  return (
    <div className="w-full rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Monet&apos;s Live Portfolio
          </p>
          <span className="text-[10px] text-muted-foreground/60 bg-muted rounded-full px-2 py-0.5">
            Paper trading
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums tracking-tight">{fmtEquity}</span>
          <span className={cn(
            "text-lg font-semibold tabular-nums",
            portfolioReturn >= 0 ? "text-emerald-600" : "text-red-500"
          )}>
            {portfolioReturn >= 0 ? "+" : ""}{portfolioReturn.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span>
            <span className={cn("font-medium", alpha >= 0 ? "text-emerald-600" : "text-red-500")}>
              {alpha >= 0 ? "+" : ""}{alpha.toFixed(2)}% alpha
            </span>
            {" "}vs SPY ({spyReturn >= 0 ? "+" : ""}{spyReturn.toFixed(2)}%)
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>since {sinceDate}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 py-3">
        <PerformanceChart snapshots={chartSnapshots} />
      </div>
    </div>
  );
}

function PerformanceChart({ snapshots }: { snapshots: Snapshot[] }) {
  const W = 440;
  const H = 140;
  const padL = 38;
  const padR = 8;
  const padT = 8;
  const padB = 22;

  const n = snapshots.length;
  const portfolioVals = snapshots.map((s) => s.portfolio_cumulative_return);
  const spyVals = snapshots.map((s) => s.spy_cumulative_return);

  const allVals = [...portfolioVals, ...spyVals, 0];
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  // Add 10% headroom
  const pad = (rawMax - rawMin) * 0.1 || 0.5;
  const minY = rawMin - pad;
  const maxY = rawMax + pad;
  const yRange = maxY - minY;

  const xPos = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const yPos = (v: number) => padT + (1 - (v - minY) / yRange) * (H - padT - padB);

  const toLinePath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`).join(" ");

  const portfolioPath = toLinePath(portfolioVals);
  const spyPath = toLinePath(spyVals);

  // Area fill under portfolio line
  const areaPath =
    portfolioPath +
    ` L${xPos(n - 1).toFixed(1)},${yPos(minY).toFixed(1)} L${xPos(0).toFixed(1)},${yPos(minY).toFixed(1)} Z`;

  // Y-axis ticks: min, 0, max (only if 0 is in range)
  const yTickValues = Array.from(new Set([rawMin, 0, rawMax].filter((v) => v >= rawMin && v <= rawMax)));
  // X-axis: first, mid, last
  const xTickIndices = [0, Math.round((n - 1) / 2), n - 1];

  const zeroY = yPos(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Zero baseline */}
      <line
        x1={padL} y1={zeroY} x2={W - padR} y2={zeroY}
        stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,3"
      />

      {/* SPY line */}
      <path d={spyPath} fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4,3" strokeLinecap="round" />

      {/* Portfolio area */}
      <path d={areaPath} fill="url(#pg)" />

      {/* Portfolio line */}
      <path d={portfolioPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Endpoint dot */}
      <circle cx={xPos(n - 1)} cy={yPos(portfolioVals[n - 1])} r="3.5" fill="#10b981" />

      {/* Y-axis labels */}
      {yTickValues.map((v) => (
        <text key={v} x={padL - 5} y={yPos(v) + 3.5} textAnchor="end" fontSize="9" fill="#9ca3af">
          {v >= 0 ? "+" : ""}{v.toFixed(1)}%
        </text>
      ))}

      {/* X-axis labels */}
      {xTickIndices.map((i) => (
        <text key={i} x={xPos(i)} y={H - 5} textAnchor="middle" fontSize="9" fill="#9ca3af">
          {new Date(snapshots[i].snapshot_date + "T12:00:00").toLocaleDateString("en-US", {
            month: "short", day: "numeric",
          })}
        </text>
      ))}

      {/* SPY legend */}
      <line x1={W - 60} y1={padT + 6} x2={W - 48} y2={padT + 6} stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4,2" />
      <text x={W - 45} y={padT + 9.5} fontSize="8.5" fill="#9ca3af">SPY</text>
    </svg>
  );
}
