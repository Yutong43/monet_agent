"""Quick smoke test: small universe, 3 months, verifies the pipeline works.

Usage: python -m backtest.smoke_test
"""

from __future__ import annotations

import logging
import sys
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf

from stock_agent.factor_scoring import BASELINE_VARIANT
from backtest.engine import SimRules, run_backtest
from backtest.metrics import summarize
from backtest.variants import VARIANTS


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

# Small, diverse basket — fast to download
SMOKE_TICKERS = [
    "AAPL", "MSFT", "NVDA", "AMD", "GOOG", "META", "AMZN",       # Tech
    "XOM", "CVX", "COP", "APA", "DVN",                            # Energy
    "JPM", "BAC", "WFC",                                          # Financials
    "PG", "KO", "WMT", "COST",                                    # Consumer
    "JNJ", "PFE", "UNH",                                          # Healthcare
    "CAT", "BA", "GE",                                            # Industrial
    "SPY",                                                         # Benchmark
]


def main():
    # 1 year of data ending today (need lookback before backtest window)
    end = datetime.now().date()
    start = (end - timedelta(days=500)).isoformat()
    end_str = end.isoformat()

    logger.info("Downloading %d tickers from %s to %s", len(SMOKE_TICKERS), start, end_str)
    data = yf.download(
        SMOKE_TICKERS,
        start=start,
        end=end_str,
        progress=False,
        auto_adjust=True,
    )
    close = data["Close"].dropna(axis=1, how="all")
    highs = data["High"].dropna(axis=1, how="all")
    lows = data["Low"].dropna(axis=1, how="all")

    logger.info("Got %d symbols × %d days", close.shape[1], close.shape[0])

    # Mock fundamentals for the smoke test
    import random
    random.seed(42)
    sectors = ["Technology", "Energy", "Financials", "Consumer", "Healthcare", "Industrial"]
    fundamentals = {}
    for sym in close.columns:
        if sym == "SPY":
            continue
        fundamentals[sym] = {
            "sector": random.choice(sectors),
            "forward_pe": random.uniform(10, 35),
            "profit_margin": random.uniform(0.05, 0.30),
            "roe": random.uniform(0.08, 0.30),
            "debt_to_equity": random.uniform(0.1, 1.5),
            "current_price": float(close[sym].iloc[-1]),
        }

    # Run backtest for last 3 months only (to keep it fast)
    backtest_start = (end - timedelta(days=90)).isoformat()
    rules = SimRules(
        starting_equity=100_000.0,
        max_positions=5,
        position_size_pct=0.12,
    )

    results_by_variant = {}
    for variant_name, variant in VARIANTS.items():
        logger.info("─── Smoke testing variant: %s ───", variant_name)
        try:
            result = run_backtest(
                variant=variant,
                rules=rules,
                close=close,
                highs=highs,
                lows=lows,
                fundamentals=fundamentals,
                start=backtest_start,
                end=end_str,
            )
            metrics = summarize(
                equity_curve=result["equity_curve"],
                trades=result["trades"],
                spy_curve=result["spy_curve"],
            )
            results_by_variant[variant_name] = metrics
            print(f"\n[{variant_name}]")
            for k, v in metrics.items():
                print(f"  {k:<22} {v}")
        except Exception as e:
            logger.error("Variant %s FAILED: %s", variant_name, e, exc_info=True)
            sys.exit(1)

    # Comparison table
    print("\n═══ Variant Comparison (smoke test) ═══")
    print(f"{'variant':<18} {'return%':>10} {'spy%':>10} {'alpha%':>10} {'sharpe':>8} {'trades':>7} {'stop%':>7}")
    print("─" * 80)
    for name, m in results_by_variant.items():
        print(
            f"{name:<18} "
            f"{str(m.get('total_return_pct')):>10} "
            f"{str(m.get('spy_return_pct')):>10} "
            f"{str(m.get('alpha_pct')):>10} "
            f"{str(m.get('sharpe')):>8} "
            f"{str(m.get('trade_count')):>7} "
            f"{str(m.get('stop_hit_rate_pct')):>7} "
        )

    logger.info("Smoke test PASSED ✓")


if __name__ == "__main__":
    main()
