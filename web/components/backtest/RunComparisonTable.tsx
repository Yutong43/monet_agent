"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface BacktestRun {
  id: string;
  variant_name: string;
  start_date: string;
  end_date: string;
  final_equity: number | null;
  total_return_pct: number | null;
  spy_return_pct: number | null;
  alpha_pct: number | null;
  sharpe: number | null;
  max_drawdown_pct: number | null;
  win_rate_pct: number | null;
  trade_count: number | null;
  stop_hit_rate_pct: number | null;
  avg_hold_days: number | null;
  status: string;
  created_at: string;
  notes: string | null;
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

function fmtNum(val: number | null, digits = 2): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(digits);
}

function pctColor(val: number | null, threshold = 0): string {
  if (val === null || val === undefined) return "";
  if (val > threshold) return "text-green-600";
  if (val < threshold) return "text-red-500";
  return "";
}

interface Props {
  onSelectRun: (id: string) => void;
  selectedId: string | null;
}

export function RunComparisonTable({ onSelectRun, selectedId }: Props) {
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/backtest/runs?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setRuns(data.runs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-60 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
            Backtest Runs
          </p>
          <p className="text-sm text-muted-foreground">
            No runs yet. Run <code className="text-xs bg-muted px-1 py-0.5 rounded">python -m backtest.runner --variant all</code> to populate.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-5 pb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Backtest Runs
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Click a row to view equity curve and trade log.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y bg-muted/30 text-[10px] uppercase text-muted-foreground">
                <th className="text-left font-medium py-2 px-3">Variant</th>
                <th className="text-left font-medium py-2 px-2">Period</th>
                <th className="text-right font-medium py-2 px-2">Return</th>
                <th className="text-right font-medium py-2 px-2">SPY</th>
                <th className="text-right font-medium py-2 px-2">Alpha</th>
                <th className="text-right font-medium py-2 px-2">Sharpe</th>
                <th className="text-right font-medium py-2 px-2">Max DD</th>
                <th className="text-right font-medium py-2 px-2">Win%</th>
                <th className="text-right font-medium py-2 px-2">Trades</th>
                <th className="text-right font-medium py-2 px-2">Stop%</th>
                <th className="text-right font-medium py-2 px-2">Hold</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const isSelected = selectedId === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelectRun(r.id)}
                    className={cn(
                      "border-b cursor-pointer transition-colors hover:bg-muted/50",
                      isSelected && "bg-muted",
                    )}
                  >
                    <td className="py-2 px-3 font-medium">{r.variant_name}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground tabular-nums">
                      {r.start_date.slice(2)}→{r.end_date.slice(2)}
                    </td>
                    <td className={cn("py-2 px-2 text-right tabular-nums font-medium", pctColor(r.total_return_pct))}>
                      {fmtPct(r.total_return_pct)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                      {fmtPct(r.spy_return_pct)}
                    </td>
                    <td className={cn("py-2 px-2 text-right tabular-nums font-semibold", pctColor(r.alpha_pct))}>
                      {fmtPct(r.alpha_pct)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmtNum(r.sharpe)}</td>
                    <td className={cn("py-2 px-2 text-right tabular-nums", pctColor(r.max_drawdown_pct))}>
                      {fmtPct(r.max_drawdown_pct)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmtNum(r.win_rate_pct, 1)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{r.trade_count ?? "—"}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{fmtNum(r.stop_hit_rate_pct, 1)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{fmtNum(r.avg_hold_days, 1)}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
