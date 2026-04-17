"""Pure factor scoring functions — shared by live system and backtester.

This module contains the math for computing factor scores without any I/O.
All inputs are passed as data structures; no yfinance, no Supabase.

The live scoring pipeline (tools.py:score_universe) is a thin wrapper that
fetches data and calls compute_factor_scores(). The backtester calls this
same function with a different FactorVariant config to simulate algorithm
changes. This prevents drift between what gets backtested and what runs live.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import pandas as pd


# ── Variant config ────────────────────────────────────────────────────────────

@dataclass
class FactorVariant:
    """Configuration for a factor scoring variant.

    momentum_lookbacks: List of (lookback_days, skip_days) tuples.
        Example baseline: [(252, 22), (63, 0)] = 12m-ex-1m + 3m.
        Example with short: [(252, 22), (63, 0), (21, 0)] = adds 1m.
    momentum_weights: Weights summing to 1.0, same length as lookbacks.
    prefilter_top_n: Only score top N by momentum on quality/value (None = score all).
    """
    name: str = "baseline"
    momentum_lookbacks: list[tuple[int, int]] = field(
        default_factory=lambda: [(252, 22), (63, 0)]
    )
    momentum_weights: list[float] = field(default_factory=lambda: [0.5, 0.5])
    prefilter_top_n: int | None = 150

    # Stop method (used by backtest engine, not scoring)
    stop_method: Literal["fixed", "atr"] = "fixed"
    stop_pct: float = 0.05
    atr_multiplier: float = 2.0
    atr_min_pct: float = 0.03
    atr_max_pct: float = 0.08

    def __post_init__(self):
        assert len(self.momentum_lookbacks) == len(self.momentum_weights), \
            "momentum_lookbacks and momentum_weights must have same length"
        total = sum(self.momentum_weights)
        assert abs(total - 1.0) < 1e-6, f"momentum_weights must sum to 1.0, got {total}"


BASELINE_VARIANT = FactorVariant(
    name="baseline",
    # Promoted from short_mom_atr after 12-month backtest showed +29.3% alpha
    # vs previous fixed-5%-stop baseline of +24.0% alpha. See release v1.4.
    # Adds 1-month momentum to capture near-term trend (classic Jegadeev-Titman
    # is too backward-looking for 5-10 day holding periods).
    momentum_lookbacks=[(252, 22), (63, 0), (21, 0)],
    momentum_weights=[0.4, 0.3, 0.3],
    prefilter_top_n=150,
    # ATR-based stops: volatility-aware, reduces whipsaws on energy/materials
    # (backtest showed stop-hit rate 55% → 35% with this change)
    stop_method="atr",
    atr_multiplier=2.0,
    atr_min_pct=0.03,
    atr_max_pct=0.08,
)


# ── Pure helpers ──────────────────────────────────────────────────────────────

def percentile_rank(series: pd.Series) -> pd.Series:
    """Rank values as percentiles (0-100). NaN preserves NaN."""
    return series.rank(pct=True, na_option="keep") * 100


def compute_momentum(close: pd.DataFrame, variant: FactorVariant) -> pd.Series:
    """Compute blended momentum score (0-100) for each symbol.

    Args:
        close: DataFrame with date index and symbol columns of close prices.
               Most recent date is last row.
        variant: FactorVariant with momentum_lookbacks + momentum_weights.

    Returns:
        Series of momentum scores (0-100), indexed by symbol.
    """
    n_rows = len(close)
    if n_rows < 2:
        return pd.Series(dtype=float)

    component_ranks: list[pd.Series] = []
    valid_syms: pd.Index | None = None

    for lookback, skip in variant.momentum_lookbacks:
        # End index: -skip if skip > 0 else -1 (last row)
        end_idx = -(skip + 1) if skip > 0 else -1
        # Start index: end - lookback
        # (lookback is the number of trading days in the window)
        start_idx = end_idx - lookback

        # Guard against insufficient data
        if n_rows + start_idx < 0:
            # Not enough history — fallback to using what's available
            start_idx = -n_rows

        try:
            end_prices = close.iloc[end_idx]
            start_prices = close.iloc[start_idx]
            ret = (end_prices / start_prices - 1).dropna()
        except Exception:
            continue

        if len(ret) == 0:
            continue

        rank = percentile_rank(ret)
        component_ranks.append(rank)
        # Intersect valid symbols across all components
        valid_syms = rank.index if valid_syms is None else valid_syms.intersection(rank.index)

    if not component_ranks or valid_syms is None or len(valid_syms) == 0:
        return pd.Series(dtype=float)

    # Weighted sum of ranks, restricted to symbols present in all components
    score = pd.Series(0.0, index=valid_syms)
    for rank, weight in zip(component_ranks, variant.momentum_weights):
        score = score + weight * rank.reindex(valid_syms).fillna(50.0)

    return score


def compute_quality(fundamentals: dict[str, dict]) -> pd.Series:
    """Compute quality score (0-100) from fundamentals.

    Quality = 0.4 * percentile(profit_margin) + 0.4 * percentile(ROE) + 0.2 * (100 - percentile(debt_to_equity))

    Args:
        fundamentals: symbol -> {profit_margin, roe, debt_to_equity, ...}

    Returns:
        Series of quality scores, indexed by symbol.
    """
    margins = pd.Series({
        sym: f.get("profit_margin")
        for sym, f in fundamentals.items()
        if f.get("profit_margin") is not None
    })
    roes = pd.Series({
        sym: f.get("roe")
        for sym, f in fundamentals.items()
        if f.get("roe") is not None
    })
    leverages = pd.Series({
        sym: f.get("debt_to_equity")
        for sym, f in fundamentals.items()
        if f.get("debt_to_equity") is not None
    })

    margin_rank = percentile_rank(margins)
    roe_rank = percentile_rank(roes)
    leverage_rank = percentile_rank(leverages)

    quality = pd.Series(dtype=float)
    for sym in fundamentals:
        m = float(margin_rank.get(sym, 50.0))
        r = float(roe_rank.get(sym, 50.0))
        l = float(leverage_rank.get(sym, 50.0))
        quality.loc[sym] = 0.4 * m + 0.4 * r + 0.2 * (100 - l)

    return quality


def compute_value(fundamentals: dict[str, dict]) -> pd.Series:
    """Compute within-sector value score (0-100) using forward P/E.

    Lower forward P/E = higher value score (within sector).
    Symbols with <2 peers in their sector get 50.0 (neutral).

    Args:
        fundamentals: symbol -> {sector, forward_pe, ...}

    Returns:
        Series of value scores, indexed by symbol.
    """
    sector_pe: dict[str, list[tuple[str, float]]] = {}
    for sym, f in fundamentals.items():
        sector = f.get("sector", "Unknown")
        fwd_pe = f.get("forward_pe")
        if fwd_pe and fwd_pe > 0:
            sector_pe.setdefault(sector, []).append((sym, float(fwd_pe)))

    scores: dict[str, float] = {}
    for sector, pe_list in sector_pe.items():
        if len(pe_list) < 2:
            for sym, _ in pe_list:
                scores[sym] = 50.0
            continue
        syms, pes = zip(*pe_list)
        pe_series = pd.Series(pes, index=syms)
        # Invert: lower P/E = higher score
        rank = 100 - percentile_rank(pe_series)
        for s in syms:
            if s in rank.index and not pd.isna(rank[s]):
                scores[s] = round(float(rank[s]), 1)

    # Fill missing symbols with 50.0
    for sym in fundamentals:
        scores.setdefault(sym, 50.0)

    return pd.Series(scores)


# ── Top-level scoring function ────────────────────────────────────────────────

def compute_factor_scores(
    close: pd.DataFrame,
    fundamentals: dict[str, dict],
    variant: FactorVariant,
    factor_weights: dict[str, float] | None = None,
    eps_revision_scores: dict[str, float] | None = None,
) -> list[dict]:
    """Compute factor scores and composite ranking for a universe.

    Pure function — no I/O. Takes price data and fundamentals, returns ranked
    list of stocks with all factor scores attached.

    Args:
        close: DataFrame (date × symbol) of close prices, most recent last.
        fundamentals: symbol -> {sector, forward_pe, profit_margin, roe, debt_to_equity, current_price}
        variant: FactorVariant config.
        factor_weights: dict of {momentum, quality, value, eps_revision} weights.
            If None, uses equal-ish defaults {0.35, 0.30, 0.20, 0.15}.
        eps_revision_scores: symbol -> score (0-100). If None, all default to 50.0.

    Returns:
        List of dicts sorted by composite_score descending, each with:
        - symbol, sector, momentum_score, quality_score, value_score,
          eps_revision_score, composite_score, rank,
          forward_pe, profit_margin, roe, debt_to_equity, current_price
    """
    if factor_weights is None:
        factor_weights = {
            "momentum": 0.35,
            "quality": 0.30,
            "value": 0.20,
            "eps_revision": 0.15,
        }

    if eps_revision_scores is None:
        eps_revision_scores = {}

    # Step 1: Momentum across full universe
    momentum_score = compute_momentum(close, variant)
    if len(momentum_score) == 0:
        return []

    # Step 2: Pre-filter top N by momentum (if configured)
    if variant.prefilter_top_n is not None and variant.prefilter_top_n > 0:
        candidates = momentum_score.nlargest(variant.prefilter_top_n).index.tolist()
    else:
        candidates = momentum_score.index.tolist()

    # Filter fundamentals to candidates only
    cand_fundamentals = {s: fundamentals[s] for s in candidates if s in fundamentals}

    if not cand_fundamentals:
        return []

    # Step 3: Quality + Value for candidates
    quality_score = compute_quality(cand_fundamentals)
    value_score = compute_value(cand_fundamentals)

    # Step 4: Assemble rankings
    results = []
    for sym, fund in cand_fundamentals.items():
        mom = round(float(momentum_score.get(sym, 50.0)), 1)
        qual = round(float(quality_score.get(sym, 50.0)), 1)
        val = round(float(value_score.get(sym, 50.0)), 1)
        eps = round(float(eps_revision_scores.get(sym, 50.0)), 1)

        composite = (
            factor_weights["momentum"] * mom
            + factor_weights["quality"] * qual
            + factor_weights["value"] * val
            + factor_weights["eps_revision"] * eps
        )

        results.append({
            "symbol": sym,
            "sector": fund.get("sector", "Unknown"),
            "forward_pe": fund.get("forward_pe"),
            "profit_margin": fund.get("profit_margin"),
            "roe": fund.get("roe"),
            "debt_to_equity": fund.get("debt_to_equity"),
            "current_price": fund.get("current_price"),
            "momentum_score": mom,
            "quality_score": qual,
            "value_score": val,
            "eps_revision_score": eps,
            "composite_score": round(composite, 1),
        })

    results.sort(key=lambda x: x["composite_score"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    return results
