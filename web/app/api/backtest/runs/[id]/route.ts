/**
 * GET /api/backtest/runs/[id]
 *
 * Returns full detail for a single backtest run:
 *   - run header (variant, config, metrics)
 *   - snapshots (equity curve)
 *   - trades (log)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [runRes, snapshotRes, tradeRes] = await Promise.all([
    sb.from("backtest_runs").select("*").eq("id", id).maybeSingle(),
    sb
      .from("backtest_snapshots")
      .select("snapshot_date, equity, cash, positions_value, spy_close, portfolio_return_pct, spy_return_pct, deployed_pct")
      .eq("run_id", id)
      .order("snapshot_date", { ascending: true }),
    sb
      .from("backtest_trades")
      .select("symbol, side, trade_date, price, quantity, composite_score, exit_reason, pnl, holding_days")
      .eq("run_id", id)
      .order("trade_date", { ascending: true }),
  ]);

  if (runRes.error) return NextResponse.json({ error: runRes.error.message }, { status: 500 });
  if (!runRes.data) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  return NextResponse.json({
    run: runRes.data,
    snapshots: snapshotRes.data ?? [],
    trades: tradeRes.data ?? [],
  });
}
