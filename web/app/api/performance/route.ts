import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: snapshots } = await supabase
      .from("equity_snapshots")
      .select("snapshot_date, portfolio_cumulative_return, spy_cumulative_return")
      .order("snapshot_date", { ascending: true })
      .limit(90);

    // Also pull live equity from Alpaca (best-effort)
    let currentEquity: number | null = null;
    try {
      const apiKey = process.env.ALPACA_API_KEY;
      const secretKey = process.env.ALPACA_SECRET_KEY;
      const baseUrl = process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets";
      if (apiKey && secretKey) {
        const res = await fetch(`${baseUrl}/v2/account`, {
          headers: {
            "APCA-API-KEY-ID": apiKey,
            "APCA-API-SECRET-KEY": secretKey,
          },
          next: { revalidate: 60 }, // cache for 60s
        });
        if (res.ok) {
          const acct = await res.json();
          currentEquity = parseFloat(acct.equity);
        }
      }
    } catch {
      // Fall back to latest snapshot
    }

    return NextResponse.json({
      snapshots: snapshots ?? [],
      currentEquity,
      startingEquity: 100_000,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load performance data" }, { status: 500 });
  }
}
