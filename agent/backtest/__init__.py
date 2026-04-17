"""Monet backtesting package.

Provides historical data loading, factor IC analysis, and portfolio simulation
for systematically comparing algorithm variants before deploying changes live.

Entry points:
    python -m backtest.factor_ic --start 2025-04 --end 2026-04
    python -m backtest.runner --variant baseline --start 2025-04 --end 2026-04
"""
