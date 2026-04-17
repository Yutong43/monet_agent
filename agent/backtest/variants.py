"""Variant definitions for backtest experiments.

Each variant is a FactorVariant config that the scoring function + simulator
will use. Add new variants here to compare against baseline.
"""

from stock_agent.factor_scoring import FactorVariant


VARIANTS: dict[str, FactorVariant] = {
    "baseline": FactorVariant(
        name="baseline",
        momentum_lookbacks=[(252, 22), (63, 0)],  # 12m-ex-1m, 3m
        momentum_weights=[0.5, 0.5],
        prefilter_top_n=150,
        stop_method="fixed",
        stop_pct=0.05,
    ),

    "short_momentum": FactorVariant(
        name="short_momentum",
        # Adds 1-month (21-day) momentum as a third component
        momentum_lookbacks=[(252, 22), (63, 0), (21, 0)],
        momentum_weights=[0.4, 0.3, 0.3],
        prefilter_top_n=150,
        stop_method="fixed",
        stop_pct=0.05,
    ),

    "atr_stops": FactorVariant(
        name="atr_stops",
        momentum_lookbacks=[(252, 22), (63, 0)],
        momentum_weights=[0.5, 0.5],
        prefilter_top_n=150,
        stop_method="atr",
        atr_multiplier=2.0,
        atr_min_pct=0.03,
        atr_max_pct=0.08,
    ),

    "short_mom_atr": FactorVariant(
        name="short_mom_atr",
        momentum_lookbacks=[(252, 22), (63, 0), (21, 0)],
        momentum_weights=[0.4, 0.3, 0.3],
        prefilter_top_n=150,
        stop_method="atr",
        atr_multiplier=2.0,
        atr_min_pct=0.03,
        atr_max_pct=0.08,
    ),
}


def get_variant(name: str) -> FactorVariant:
    """Get a variant by name, or raise."""
    if name not in VARIANTS:
        raise ValueError(f"Unknown variant: {name}. Available: {list(VARIANTS.keys())}")
    return VARIANTS[name]
