"use client";

import { useState } from "react";
import { IcHeatmap } from "@/components/backtest/IcHeatmap";
import { RunComparisonTable } from "@/components/backtest/RunComparisonTable";
import { RunDetail } from "@/components/backtest/RunDetail";

export default function BacktestsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Backtests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Factor IC analysis and portfolio simulation results. Run new backtests via CLI:{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">python -m backtest.runner --variant all</code>
        </p>
      </div>

      {/* Factor IC */}
      <IcHeatmap />

      {/* Run comparison table */}
      <RunComparisonTable onSelectRun={setSelectedId} selectedId={selectedId} />

      {/* Selected run detail */}
      {selectedId && <RunDetail runId={selectedId} />}
    </div>
  );
}
