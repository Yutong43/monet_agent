"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface IcRow {
  variant_name: string;
  factor_name: string;
  forward_horizon_days: number;
  ic_mean: number;
  ic_tstat: number;
  sample_size: number;
}

const HORIZONS = [5, 10, 20, 60];
const FACTORS = ["momentum", "quality", "value", "composite"];

function icColor(mean: number | null, tstat: number | null): string {
  if (mean === null || mean === undefined) return "bg-muted text-muted-foreground";
  const significant = tstat !== null && Math.abs(tstat) >= 2;
  if (mean >= 0.05) return significant ? "bg-green-600 text-white" : "bg-green-200 text-green-900";
  if (mean >= 0.02) return significant ? "bg-green-400 text-white" : "bg-green-100 text-green-900";
  if (mean >= 0.0)  return "bg-slate-100 text-slate-700";
  if (mean >= -0.02) return "bg-orange-100 text-orange-900";
  return significant ? "bg-red-500 text-white" : "bg-red-200 text-red-900";
}

export function IcHeatmap() {
  const [rows, setRows] = useState<IcRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/backtest/ic")
      .then((r) => r.json())
      .then((data) => {
        setRows(data.ic ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
            Factor IC
          </p>
          <p className="text-sm text-muted-foreground">
            No IC data yet. Run <code className="text-xs bg-muted px-1 py-0.5 rounded">python -m backtest.factor_ic</code> to populate.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by variant
  const byVariant: Record<string, IcRow[]> = {};
  for (const r of rows) {
    if (!byVariant[r.variant_name]) byVariant[r.variant_name] = [];
    byVariant[r.variant_name].push(r);
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Factor IC Analysis
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Rank correlation between factor scores and forward N-day returns. |t| &ge; 2 = statistically significant.
          </p>
        </div>

        {Object.entries(byVariant).map(([variant, variantRows]) => {
          const grid: Record<string, Record<number, IcRow | undefined>> = {};
          for (const f of FACTORS) grid[f] = {};
          for (const r of variantRows) {
            if (FACTORS.includes(r.factor_name)) grid[r.factor_name][r.forward_horizon_days] = r;
          }

          return (
            <div key={variant} className="space-y-2">
              <p className="text-sm font-semibold">{variant}</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-muted-foreground text-[10px] uppercase">
                    <th className="text-left font-medium py-1 pr-3">Factor</th>
                    {HORIZONS.map((h) => (
                      <th key={h} className="font-medium py-1 px-2 text-center">
                        {h}d forward
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FACTORS.map((factor) => (
                    <tr key={factor} className="border-t">
                      <td className="py-1.5 pr-3 font-medium">{factor}</td>
                      {HORIZONS.map((h) => {
                        const cell = grid[factor][h];
                        const mean = cell?.ic_mean ?? null;
                        const tstat = cell?.ic_tstat ?? null;
                        const significant = tstat !== null && Math.abs(tstat) >= 2;
                        return (
                          <td
                            key={h}
                            className={cn(
                              "py-1.5 px-2 text-center tabular-nums font-mono border rounded",
                              icColor(mean, tstat),
                            )}
                            title={
                              cell
                                ? `IC=${mean?.toFixed(4)} t=${tstat?.toFixed(2)} n=${cell.sample_size}`
                                : "No data"
                            }
                          >
                            {mean !== null && mean !== undefined ? (
                              <>
                                {mean > 0 ? "+" : ""}
                                {mean.toFixed(3)}
                                {significant && <span className="ml-0.5">*</span>}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
