"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Snapshot {
  snapshot_date: string;
  equity: number;
  cash: number;
  positions_value: number;
  spy_close: number | null;
  portfolio_return_pct: number;
  spy_return_pct: number | null;
  deployed_pct: number;
}

interface Trade {
  symbol: string;
  side: string;
  trade_date: string;
  price: number;
  quantity: number;
  composite_score: number | null;
  exit_reason: string | null;
  pnl: number | null;
  holding_days: number | null;
}

interface RunDetail {
  run: {
    id: string;
    variant_name: string;
    variant_config: unknown;
    start_date: string;
    end_date: string;
    starting_equity: number;
    final_equity: number | null;
    total_return_pct: number | null;
    spy_return_pct: number | null;
    alpha_pct: number | null;
    sharpe: number | null;
    max_drawdown_pct: number | null;
    win_rate_pct: number | null;
    notes: string | null;
  };
  snapshots: Snapshot[];
  trades: Trade[];
}

interface Props {
  runId: string;
}

function pnlColor(val: number | null): string {
  if (val === null || val === undefined) return "";
  if (val > 0) return "text-green-600";
  if (val < 0) return "text-red-500";
  return "";
}

export function RunDetail({ runId }: Props) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/backtest/runs/${runId}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!detail) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Run not found.</p>
        </CardContent>
      </Card>
    );
  }

  // Build chart data: portfolio return % vs SPY return % over time
  const chartData = detail.snapshots.map((s) => ({
    date: s.snapshot_date,
    portfolio: s.portfolio_return_pct,
    spy: s.spy_return_pct ?? 0,
    alpha: s.spy_return_pct !== null ? s.portfolio_return_pct - s.spy_return_pct : 0,
  }));

  const closedTrades = detail.trades.filter((t) => t.pnl !== null);
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Header + config */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Run Detail
              </p>
              <h2 className="text-xl font-semibold mt-1">{detail.run.variant_name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {detail.run.start_date} → {detail.run.end_date}
              </p>
            </div>
            <div className="text-right text-sm">
              <div className={cn("text-2xl font-bold tabular-nums", pnlColor(detail.run.alpha_pct))}>
                {detail.run.alpha_pct !== null
                  ? `${detail.run.alpha_pct > 0 ? "+" : ""}${detail.run.alpha_pct.toFixed(2)}%`
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">alpha vs SPY</div>
            </div>
          </div>
          {detail.run.notes && (
            <p className="text-xs text-muted-foreground border-t pt-2">{detail.run.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Equity curve */}
      <Card>
        <CardContent className="p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">
            Equity Curve (return % vs SPY)
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => v.slice(5)}
                  interval="preserveStartEnd"
                  minTickGap={40}
                  fontSize={10}
                />
                <YAxis
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  fontSize={10}
                />
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? `${v.toFixed(2)}%` : String(v ?? "")
                  }
                  labelFormatter={(d) => d}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="Portfolio"
                  stroke="#111827"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="spy"
                  name="SPY"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="alpha"
                  name="Alpha"
                  stroke="#16a34a"
                  strokeWidth={1}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Trades table */}
      <Card>
        <CardContent className="p-0">
          <div className="p-5 pb-3 flex items-baseline justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Trades
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {closedTrades.length} closed, total P&amp;L ${totalPnl.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/40 border-y">
                <tr className="text-[10px] uppercase text-muted-foreground">
                  <th className="text-left font-medium py-2 px-3">Date</th>
                  <th className="text-left font-medium py-2 px-2">Symbol</th>
                  <th className="text-left font-medium py-2 px-2">Side</th>
                  <th className="text-right font-medium py-2 px-2">Price</th>
                  <th className="text-right font-medium py-2 px-2">Qty</th>
                  <th className="text-right font-medium py-2 px-2">Comp</th>
                  <th className="text-left font-medium py-2 px-2">Exit</th>
                  <th className="text-right font-medium py-2 px-2">P&amp;L</th>
                  <th className="text-right font-medium py-2 px-3">Hold</th>
                </tr>
              </thead>
              <tbody>
                {detail.trades.map((t, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="py-1.5 px-3 tabular-nums text-muted-foreground">{t.trade_date}</td>
                    <td className="py-1.5 px-2 font-mono font-medium">{t.symbol}</td>
                    <td className={cn("py-1.5 px-2 uppercase text-[10px] font-semibold",
                      t.side === "buy" ? "text-blue-600" : "text-orange-600")}>
                      {t.side}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">${t.price?.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{t.quantity}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                      {t.composite_score?.toFixed(1) ?? "—"}
                    </td>
                    <td className="py-1.5 px-2 text-muted-foreground text-[10px]">
                      {t.exit_reason ?? "—"}
                    </td>
                    <td className={cn("py-1.5 px-2 text-right tabular-nums font-medium", pnlColor(t.pnl))}>
                      {t.pnl !== null ? `$${t.pnl.toFixed(0)}` : "—"}
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">
                      {t.holding_days !== null ? `${t.holding_days}d` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
