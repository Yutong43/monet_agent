/**
 * GET /api/backtest/runs
 *
 * Lists recent backtest runs with summary metrics.
 * Optional query params:
 *   - limit (default 50)
 *   - variant (filter by variant_name)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const variant = searchParams.get("variant");

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  let query = sb
    .from("backtest_runs")
    .select(
      "id, variant_name, start_date, end_date, starting_equity, final_equity, total_return_pct, spy_return_pct, alpha_pct, sharpe, max_drawdown_pct, win_rate_pct, trade_count, avg_hold_days, stop_hit_rate_pct, status, notes, created_at, completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (variant) query = query.eq("variant_name", variant);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data ?? [] });
}
