"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FlaskConical, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface BacktestRun {
  id: string;
  variant_name: string;
  start_date: string;
  end_date: string;
  alpha_pct: number | null;
  sharpe: number | null;
  win_rate_pct: number | null;
  stop_hit_rate_pct: number | null;
  created_at: string;
}

function pnlColor(val: number | null): string {
  if (val === null || val === undefined) return "";
  if (val > 0) return "text-green-600";
  if (val < 0) return "text-red-500";
  return "";
}

/** Surfaces the best backtest variant on the dashboard for quick reference. */
export function BacktestSummaryCard() {
  const [bestRun, setBestRun] = useState<BacktestRun | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/backtest/runs?limit=50")
      .then((r) => r.json())
      .then((data) => {
        const runs = (data.runs ?? []) as BacktestRun[];
        // Pick highest alpha as "best"
        const withAlpha = runs.filter((r) => r.alpha_pct !== null);
        if (withAlpha.length > 0) {
          const best = withAlpha.reduce((a, b) =>
            (a.alpha_pct ?? 0) > (b.alpha_pct ?? 0) ? a : b,
          );
          setBestRun(best);
        }
        setRunCount(runs.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!bestRun) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <FlaskConical className="size-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Backtest Lab
            </p>
          </div>
          <p className="text-muted-foreground text-sm mt-2">
            No backtests yet. Run{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">python -m backtest.runner</code>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link href="/backtests" className="block group">
      <Card className="transition-colors hover:bg-muted/30">
        <CardContent className="p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="size-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Backtest Lab
              </p>
            </div>
            <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Best alpha */}
          <div className="flex items-end gap-2">
            <span className={cn("text-4xl font-bold tabular-nums leading-none", pnlColor(bestRun.alpha_pct))}>
              {bestRun.alpha_pct !== null && bestRun.alpha_pct > 0 ? "+" : ""}
              {bestRun.alpha_pct?.toFixed(1)}%
            </span>
            <span className="text-sm font-semibold text-muted-foreground mb-0.5">
              best alpha
            </span>
          </div>

          {/* Sub-rows */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Leader</span>
              <span className="font-medium">{bestRun.variant_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sharpe</span>
              <span className="font-medium tabular-nums">{bestRun.sharpe?.toFixed(2) ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Win rate</span>
              <span className="font-medium tabular-nums">
                {bestRun.win_rate_pct !== null ? `${bestRun.win_rate_pct.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Runs completed</span>
              <span className="font-medium tabular-nums">{runCount}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground border-t pt-2 mt-1">
            {bestRun.start_date} → {bestRun.end_date}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
