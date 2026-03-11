import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;
  const baseUrl = process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets";

  if (!apiKey || !secretKey) {
    return NextResponse.json({ error: "Alpaca credentials not configured" }, { status: 500 });
  }

  const headers = {
    "APCA-API-KEY-ID": apiKey,
    "APCA-API-SECRET-KEY": secretKey,
  };

  try {
    const [accountRes, positionsRes] = await Promise.all([
      fetch(`${baseUrl}/v2/account`, { headers }),
      fetch(`${baseUrl}/v2/positions`, { headers }),
    ]);

    if (!accountRes.ok || !positionsRes.ok) {
      return NextResponse.json({ error: "Alpaca API error" }, { status: 502 });
    }

    const account = await accountRes.json();
    const positions = await positionsRes.json();

    return NextResponse.json({
      account: {
        equity: parseFloat(account.equity),
        cash: parseFloat(account.cash),
        buying_power: parseFloat(account.buying_power),
        portfolio_value: parseFloat(account.portfolio_value),
        daily_pnl: parseFloat(account.equity) - parseFloat(account.last_equity),
      },
      positions: positions.map((p: Record<string, string>) => ({
        symbol: p.symbol,
        qty: parseFloat(p.qty),
        market_value: parseFloat(p.market_value),
        unrealized_pl: parseFloat(p.unrealized_pl),
        unrealized_plpc: parseFloat(p.unrealized_plpc),
        current_price: parseFloat(p.current_price),
        avg_entry_price: parseFloat(p.avg_entry_price),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch portfolio data" }, { status: 500 });
  }
}
