"""Backtest CLI entry point.

Usage:
    python -m backtest.runner --variant baseline --start 2025-04-01 --end 2026-04-01
    python -m backtest.runner --variant all --start 2025-04-01 --end 2026-04-01

Runs the full portfolio simulation for one or all variants, computes metrics,
and persists results to Supabase (unless --no-persist).
"""

from __future__ import annotations

import argparse
import logging
from dataclasses import asdict
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv()

from backtest.data import load_fundamentals, load_highs_lows, load_prices
from backtest.engine import SimRules, run_backtest
from backtest.metrics import summarize
from backtest.persist import persist_run
from backtest.variants import VARIANTS, get_variant

logger = logging.getLogger(__name__)


def run_one(
    variant_name: str,
    rules: SimRules,
    close,
    highs,
    lows,
    fundamentals: dict,
    start: str,
    end: str,
    persist: bool = True,
    notes: str | None = None,
) -> dict:
    """Run a single variant and optionally persist."""
    variant = get_variant(variant_name)
    logger.info("═══ Backtesting variant: %s ═══", variant_name)
    result = run_backtest(
        variant=variant,
        rules=rules,
        close=close,
        highs=highs,
        lows=lows,
        fundamentals=fundamentals,
        start=start,
        end=end,
    )

    metrics = summarize(
        equity_curve=result["equity_curve"],
        trades=result["trades"],
        spy_curve=result["spy_curve"],
    )

    # Print summary
    print(f"\n─── {variant_name} — {start} to {end} ───")
    for k, v in metrics.items():
        print(f"  {k:<22} {v}")

    if persist:
        try:
            run_id = persist_run(
                variant=variant,
                rules_dict=asdict(rules),
                start=start,
                end=end,
                starting_equity=rules.starting_equity,
                equity_curve=result["equity_curve"],
                cash_curve=result["cash_curve"],
                spy_curve=result["spy_curve"],
                trades=result["trades"],
                metrics=metrics,
                notes=notes,
            )
            print(f"  Persisted as run_id: {run_id}")
        except Exception as e:
            logger.error("Persist failed: %s", e)

    return {"variant": variant_name, "metrics": metrics}


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

    parser = argparse.ArgumentParser(description="Run a portfolio backtest")
    parser.add_argument("--variant", default="baseline",
                        choices=list(VARIANTS.keys()) + ["all"])
    parser.add_argument("--start", default=None, help="YYYY-MM-DD (default: 1y ago)")
    parser.add_argument("--end", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--starting-equity", type=float, default=100_000.0)
    parser.add_argument("--no-persist", action="store_true")
    parser.add_argument("--force-refresh", action="store_true")
    parser.add_argument("--notes", default=None, help="Freeform notes for this run")
    args = parser.parse_args()

    today = datetime.now().date()
    end = args.end or today.isoformat()
    start = args.start or (today - timedelta(days=365)).isoformat()

    # Need extra history before start for momentum lookback
    data_start = (datetime.fromisoformat(start) - timedelta(days=400)).date().isoformat()

    logger.info("Loading prices: %s → %s", data_start, end)
    close = load_prices(data_start, end, force_refresh=args.force_refresh)

    logger.info("Loading OHLC (for ATR)")
    highs, lows = load_highs_lows(data_start, end, force_refresh=args.force_refresh)

    logger.info("Loading fundamentals")
    fundamentals = load_fundamentals(force_refresh=args.force_refresh)

    rules = SimRules(starting_equity=args.starting_equity)

    variant_names = list(VARIANTS.keys()) if args.variant == "all" else [args.variant]

    results = []
    for name in variant_names:
        try:
            r = run_one(
                variant_name=name,
                rules=rules,
                close=close,
                highs=highs,
                lows=lows,
                fundamentals=fundamentals,
                start=start,
                end=end,
                persist=not args.no_persist,
                notes=args.notes,
            )
            results.append(r)
        except Exception as e:
            logger.error("Variant %s failed: %s", name, e, exc_info=True)

    # Final comparison table if multiple variants
    if len(results) > 1:
        print("\n═══ Variant Comparison ═══")
        headers = ["variant", "return%", "spy%", "alpha%", "sharpe", "maxDD%", "winRate%", "trades", "stopRate%"]
        print(" | ".join(f"{h:<10}" for h in headers))
        print("─" * 110)
        for r in results:
            m = r["metrics"]
            row = [
                r["variant"],
                m.get("total_return_pct"),
                m.get("spy_return_pct"),
                m.get("alpha_pct"),
                m.get("sharpe"),
                m.get("max_drawdown_pct"),
                m.get("win_rate_pct"),
                m.get("trade_count"),
                m.get("stop_hit_rate_pct"),
            ]
            print(" | ".join(f"{str(x):<10}" for x in row))


if __name__ == "__main__":
    main()
