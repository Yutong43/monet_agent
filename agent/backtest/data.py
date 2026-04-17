"""Historical data loader with on-disk caching.

Downloads bulk price history for the S&P 500 + S&P 400 universe once and
caches to parquet for reuse across all variants and runs.

Fundamentals are fetched separately via yfinance.Ticker.info and cached
as a JSON snapshot. Note: yfinance fundamentals are point-in-time as of
"now," so for a 12-month backtest we treat them as slowly-varying — an
acceptable approximation for a factor-based strategy where rankings
wouldn't swing dramatically quarter to quarter.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import yfinance as yf

from stock_agent.tools import get_sp500_sp400_tickers

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent / ".cache"
CACHE_DIR.mkdir(exist_ok=True)


def _prices_cache_path(start: str, end: str) -> Path:
    return CACHE_DIR / f"prices_{start}_{end}.parquet"


def _fundamentals_cache_path() -> Path:
    return CACHE_DIR / "fundamentals.json"


def load_prices(
    start: str,
    end: str,
    force_refresh: bool = False,
) -> pd.DataFrame:
    """Load historical close prices for the full universe.

    Args:
        start: ISO date string (YYYY-MM-DD).
        end:   ISO date string (YYYY-MM-DD).
        force_refresh: If True, re-download even if cached.

    Returns:
        DataFrame with date index and ticker columns (close prices, adjusted).
    """
    cache_path = _prices_cache_path(start, end)

    if cache_path.exists() and not force_refresh:
        logger.info("Loading cached prices from %s", cache_path.name)
        return pd.read_parquet(cache_path)

    tickers = get_sp500_sp400_tickers()
    if not tickers:
        raise RuntimeError("Could not fetch ticker universe")

    # Also include SPY as benchmark
    all_tickers = sorted(set(tickers) | {"SPY"})

    logger.info("Downloading prices for %d tickers from %s to %s", len(all_tickers), start, end)
    price_data = yf.download(
        all_tickers,
        start=start,
        end=end,
        progress=False,
        threads=True,
        auto_adjust=True,
    )

    if price_data.empty:
        raise RuntimeError("No price data returned")

    close = price_data["Close"]
    # Drop symbols that have all-NaN columns (delisted or ticker mismatch)
    close = close.dropna(axis=1, how="all")

    # Persist
    close.to_parquet(cache_path)
    logger.info("Cached %d symbols × %d days to %s", close.shape[1], close.shape[0], cache_path.name)

    return close


def load_highs_lows(
    start: str,
    end: str,
    force_refresh: bool = False,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load high and low prices (for ATR calculation in engine).

    Returns:
        (high_df, low_df) — each a DataFrame with date index × ticker cols.
    """
    hl_cache = CACHE_DIR / f"highlow_{start}_{end}.parquet"

    if hl_cache.exists() and not force_refresh:
        df = pd.read_parquet(hl_cache)
        highs = df.xs("high", axis=1, level=0)
        lows = df.xs("low", axis=1, level=0)
        return highs, lows

    tickers = get_sp500_sp400_tickers()
    logger.info("Downloading OHLC for ATR: %d tickers", len(tickers))
    data = yf.download(
        tickers,
        start=start,
        end=end,
        progress=False,
        threads=True,
        auto_adjust=True,
    )
    highs = data["High"].dropna(axis=1, how="all")
    lows = data["Low"].dropna(axis=1, how="all")

    # Combined to one parquet with MultiIndex columns
    combined = pd.concat({"high": highs, "low": lows}, axis=1)
    combined.to_parquet(hl_cache)

    return highs, lows


def load_fundamentals(force_refresh: bool = False) -> dict[str, dict]:
    """Fetch fundamentals for the full universe and cache to JSON.

    Args:
        force_refresh: Re-fetch even if cache exists.

    Returns:
        Dict of symbol -> {sector, forward_pe, profit_margin, roe, debt_to_equity, current_price}
    """
    cache_path = _fundamentals_cache_path()

    if cache_path.exists() and not force_refresh:
        with open(cache_path) as f:
            data = json.load(f)
        logger.info("Loaded cached fundamentals for %d symbols", len(data))
        return data

    tickers = get_sp500_sp400_tickers()
    logger.info("Fetching fundamentals for %d tickers (~5-10 minutes)...", len(tickers))

    fundamentals: dict[str, dict] = {}
    for i, sym in enumerate(tickers):
        if i % 50 == 0 and i > 0:
            logger.info("  ...%d / %d", i, len(tickers))
        try:
            info = yf.Ticker(sym).info
            fundamentals[sym] = {
                "sector": info.get("sector", "Unknown"),
                "forward_pe": info.get("forwardPE"),
                "profit_margin": info.get("profitMargins"),
                "roe": info.get("returnOnEquity"),
                "debt_to_equity": info.get("debtToEquity"),
                "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            }
        except Exception as e:
            logger.debug("Failed %s: %s", sym, e)
            continue

    with open(cache_path, "w") as f:
        json.dump(fundamentals, f, indent=2, default=str)
    logger.info("Cached %d fundamentals to %s", len(fundamentals), cache_path.name)

    return fundamentals


def get_spy_benchmark(close: pd.DataFrame, start_date: pd.Timestamp) -> pd.Series:
    """Extract SPY series from close DataFrame starting from start_date.

    Returns SPY close prices indexed by date, or empty series if missing.
    """
    if "SPY" not in close.columns:
        return pd.Series(dtype=float)
    spy = close["SPY"].dropna()
    return spy[spy.index >= start_date]


def trading_days_in_range(close: pd.DataFrame, start: str, end: str) -> pd.DatetimeIndex:
    """Get the list of trading days in [start, end] from the price index."""
    start_ts = pd.Timestamp(start)
    end_ts = pd.Timestamp(end)
    return close.index[(close.index >= start_ts) & (close.index <= end_ts)]
