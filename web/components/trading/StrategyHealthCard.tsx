"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface IcStat {
  mean: number | null;
  tstat: number | null;
  n: number;
}

interface StrategyHealth {
  variant: string;
  current_ic: Record<string, Record<string, IcStat>>;
  drift_flags: string[];
  deltas_vs_prior: Record<string, Record<string, { prev: number; curr: number; delta: number }>>;
  as_of: string;
}

interface StrategyDivergence {
  status: string;
  live_alpha_annualized_pct?: number;
  backtest_alpha_annualized_pct?: number;
  divergence_ratio?: number;
  action?: string;
  message?: string;
  as_of: string;
}

const FACTORS = ["momentum", "quality", "value", "composite"];

function icTrendIcon(delta: number | undefined | null) {
  if (delta === undefined || delta === null) return <Minus className="size-3 text-muted-foreground" />;
  if (delta > 0.005) return <TrendingUp className="size-3 text-green-600" />;
  if (delta < -0.005) return <TrendingDown className="size-3 text-red-500" />;
  return <Minus className="size-3 text-muted-foreground" />;
}

function icColor(mean: number | null | undefined, tstat: number | null | undefined): string {
  if (mean === null || mean === undefined) return "text-muted-foreground";
  const significant = tstat !== null && tstat !== undefined && Math.abs(tstat) >= 2;
  if (mean >= 0.02) return significant ? "text-green-600 font-semibold" : "text-green-600";
  if (mean > 0) return "text-green-500";
  if (mean <= -0.02) return significant ? "text-red-600 font-semibold" : "text-red-500";
  return "text-orange-500";
}

function divergenceColor(status: string): string {
  if (status === "major_underperformance") return "text-red-600";
  if (status === "moderate_underperformance") return "text-orange-500";
  if (status === "aligned") return "text-green-600";
  if (status.includes("outperformance")) return "text-blue-600";
  return "text-muted-foreground";
}

function divergenceLabel(status: string): string {
  switch (status) {
    case "major_underperformance":    return "Major Under";
    case "moderate_underperformance": return "Mild Under";
    case "aligned":                   return "Aligned";
    case "moderate_outperformance":   return "Mild Over";
    case "major_outperformance":      return "Major Over";
    case "insufficient_data":         return "Insufficient Data";
    case "no_backtest":               return "No Backtest";
    default:                          return status;
  }
}

/** Surfaces IC drift + live vs backtest divergence on the dashboard. */
export function StrategyHealthCard() {
  const [health, setHealth] = useState<StrategyHealth | null>(null);
  const [divergence, setDivergence] = useState<StrategyDivergence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [healthRow, divRow] = await Promise.all([
        supabase.from("agent_memory").select("value").eq("key", "strategy_health").maybeSingle(),
        supabase.from("agent_memory").select("value").eq("key", "strategy_divergence").maybeSingle(),
      ]);
      if (healthRow.data?.value) setHealth(healthRow.data.value as StrategyHealth);
      if (divRow.data?.value) setDivergence(divRow.data.value as StrategyDivergence);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!health && !divergence) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Activity className="size-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Strategy Health
            </p>
          </div>
          <p className="text-muted-foreground text-sm mt-2">
            No data yet — runs on next Sunday weekly review (IC audit) and daily EOD reflection (divergence).
          </p>
        </CardContent>
      </Card>
    );
  }

  // Build IC row at 20d horizon (most actionable for weekly review)
  const ic20d = health?.current_ic ?? {};
  const deltas20d = health?.deltas_vs_prior ?? {};

  const driftFlagCount = health?.drift_flags?.length ?? 0;

  return (
    <Link href="/backtests" className="block group">
      <Card className="transition-colors hover:bg-muted/30">
        <CardContent className="p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Strategy Health
              </p>
            </div>
            <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Live vs Backtest Divergence — hero metric */}
          {divergence && divergence.status !== "insufficient_data" && divergence.status !== "no_backtest" && (
            <div>
              <div className="flex items-end gap-2">
                <span className={cn("text-2xl font-bold tabular-nums leading-none", divergenceColor(divergence.status))}>
                  {divergenceLabel(divergence.status)}
                </span>
                {divergence.divergence_ratio !== undefined && (
                  <span className="text-xs text-muted-foreground mb-0.5">
                    ({divergence.divergence_ratio > 0 ? "+" : ""}
                    {(divergence.divergence_ratio * 100).toFixed(0)}% vs backtest)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Live vs backtest alpha
              </p>
            </div>
          )}

          {/* Factor IC row — 20-day horizon */}
          {health && Object.keys(ic20d).length > 0 && (
            <div className="space-y-1.5 text-sm pt-1 border-t">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Factor IC (20d)
                </span>
                {driftFlagCount > 0 && (
                  <span className="text-[10px] text-orange-500 font-semibold">
                    {driftFlagCount} drift alert{driftFlagCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {FACTORS.map((f) => {
                const stat = ic20d[f]?.["20"];
                const delta = deltas20d[f]?.["20"]?.delta;
                const mean = stat?.mean;
                const tstat = stat?.tstat;
                return (
                  <div key={f} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground capitalize">{f}</span>
                    <div className="flex items-center gap-1">
                      {icTrendIcon(delta)}
                      <span className={cn("tabular-nums font-mono w-14 text-right", icColor(mean, tstat))}>
                        {mean !== null && mean !== undefined
                          ? `${mean > 0 ? "+" : ""}${mean.toFixed(3)}${tstat !== null && tstat !== undefined && Math.abs(tstat) >= 2 ? "*" : ""}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Last updated */}
          <p className="text-[10px] text-muted-foreground pt-1 border-t">
            {health?.as_of && `IC ${new Date(health.as_of).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            {health?.as_of && divergence?.as_of && " • "}
            {divergence?.as_of && `Div ${new Date(divergence.as_of).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
