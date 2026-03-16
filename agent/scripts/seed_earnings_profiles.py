"""Seed earnings_profile:SYMBOL entries for all currently held positions.

Fetches 4-quarter earnings history from Finnhub, derives pattern/stats,
and writes to agent_memory so the dashboard Earnings Intelligence card
is populated.
"""

from dotenv import load_dotenv
load_dotenv()

import time
from datetime import datetime
from stock_agent.db import write_memory
from stock_agent.market_data import get_portfolio
from stock_agent.tools import get_earnings_results


def derive_pattern(summary: dict) -> str:
    """Derive an earnings pattern label from summary stats."""
    beat_rate = summary.get("beat_rate", 0)
    beat_streak = summary.get("beat_streak", 0)
    avg_surprise = summary.get("avg_surprise_pct", 0)
    quarters = summary.get("quarters_available", 0)

    if quarters == 0:
        return "unknown"

    if beat_rate >= 0.75 and avg_surprise > 5:
        return "systematic_underestimation"
    if beat_rate >= 0.75:
        return "reliable_beater"
    if beat_rate <= 0.25:
        return "declining"
    return "volatile"


def derive_insight(symbol: str, summary: dict, pattern: str, forward: dict) -> str:
    """Generate a one-line insight from the earnings data."""
    avg = summary.get("avg_surprise_pct", 0)
    streak = summary.get("beat_streak", 0)
    quarters = summary.get("quarters_available", 0)
    revision = forward.get("revision_signal", "unknown")

    if pattern == "systematic_underestimation":
        base = f"Sell-side consistently underestimates {symbol} — avg surprise +{avg}% over {quarters}Q."
    elif pattern == "reliable_beater":
        base = f"{symbol} beats estimates reliably ({streak}-quarter streak), avg surprise +{avg}%."
    elif pattern == "declining":
        base = f"{symbol} has been missing estimates — avg surprise {avg}% over {quarters}Q."
    else:
        base = f"{symbol} earnings are volatile — avg surprise {avg}% across {quarters}Q."

    if revision and revision != "unknown":
        base += f" Estimate revisions: {revision}."

    return base


def main():
    print("Fetching current portfolio positions...")
    portfolio = get_portfolio()
    positions = portfolio.get("positions", [])

    if not positions:
        print("No positions found. Nothing to seed.")
        return

    symbols = [p["symbol"] for p in positions]
    print(f"Found {len(symbols)} positions: {', '.join(symbols)}\n")

    success = 0
    for sym in symbols:
        print(f"--- {sym} ---")
        try:
            data = get_earnings_results(sym)
        except Exception as e:
            print(f"  ERROR fetching earnings: {e}")
            time.sleep(0.5)
            continue

        summary = data.get("summary", {})
        quarters = summary.get("quarters_available", 0)

        if quarters == 0:
            print(f"  No earnings history available, skipping.")
            time.sleep(0.5)
            continue

        pattern = derive_pattern(summary)
        forward = data.get("forward_estimates", {})
        insight = derive_insight(sym, summary, pattern, forward)

        # Build the history list
        history = []
        for s in data.get("surprise_history", []):
            history.append({
                "quarter": s.get("period", ""),
                "surprise_pct": s.get("surprise_pct", 0),
                "actual_eps": s.get("actual"),
                "estimated_eps": s.get("estimate"),
            })

        # Determine key metric from forward estimates
        key_metric = ""
        if forward.get("revision_signal"):
            key_metric = f"Estimate revision signal: {forward['revision_signal']}"

        profile = {
            "symbol": sym,
            "pattern": pattern,
            "quarters_tracked": quarters,
            "avg_surprise_pct": summary.get("avg_surprise_pct", 0),
            "beat_streak": summary.get("beat_streak", 0),
            "beat_rate": summary.get("beat_rate", 0),
            "key_metric": key_metric,
            "agent_insight": insight,
            "history": history,
            "bootstrapped_at": datetime.now().isoformat(),
            "last_updated": datetime.now().isoformat(),
        }

        result = write_memory(f"earnings_profile:{sym}", profile)
        print(f"  pattern: {pattern}")
        print(f"  {summary['beat_streak']}/{quarters} beats, avg surprise {summary['avg_surprise_pct']}%")
        print(f"  insight: {insight[:100]}...")
        print(f"  written (id={result.get('id', 'ok')})")
        success += 1

        # Rate limit Finnhub calls
        time.sleep(0.5)

    print(f"\nDone! Seeded {success}/{len(symbols)} earnings profiles.")


if __name__ == "__main__":
    main()
