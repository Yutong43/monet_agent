/**
 * GET /api/backtest/ic
 *
 * Returns factor IC results grouped by variant -> factor -> horizon.
 * Returns the most recent IC run per (variant, factor, horizon) combination.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const variant = searchParams.get("variant");

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  let query = sb
    .from("factor_ic_runs")
    .select("variant_name, factor_name, forward_horizon_days, ic_mean, ic_std, ic_tstat, sample_size, start_date, end_date, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (variant) query = query.eq("variant_name", variant);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deduplicate: keep only the most recent row per (variant, factor, horizon)
  const seen = new Set<string>();
  const latest: typeof data = [];
  for (const row of data ?? []) {
    const key = `${row.variant_name}|${row.factor_name}|${row.forward_horizon_days}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(row);
  }

  return NextResponse.json({ ic: latest });
}
