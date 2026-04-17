"""Portfolio performance metrics for backtest results."""

from __future__ import annotations

import numpy as np
import pandas as pd


def sharpe_ratio(returns: pd.Series, periods_per_year: int = 252) -> float:
    """Annualized Sharpe ratio (rf=0 assumption for simplicity)."""
    if len(returns) < 2 or returns.std() == 0:
        return 0.0
    return float(returns.mean() / returns.std() * np.sqrt(periods_per_year))


def sortino_ratio(returns: pd.Series, periods_per_year: int = 252) -> float:
    """Annualized Sortino (downside deviation only)."""
    if len(returns) < 2:
        return 0.0
    downside = returns[returns < 0]
    if len(downside) == 0 or downside.std() == 0:
        return 0.0
    return float(returns.mean() / downside.std() * np.sqrt(periods_per_year))


def max_drawdown(equity: pd.Series) -> float:
    """Max drawdown as a negative percentage (e.g. -0.15 = -15%)."""
    if len(equity) < 2:
        return 0.0
    running_max = equity.cummax()
    drawdown = (equity - running_max) / running_max
    return float(drawdown.min())


def win_rate(trades: list[dict]) -> float:
    """Fraction of closed trades with positive P&L."""
    closed = [t for t in trades if t.get("pnl") is not None]
    if not closed:
        return 0.0
    wins = sum(1 for t in closed if t["pnl"] > 0)
    return wins / len(closed)


def profit_factor(trades: list[dict]) -> float:
    """Ratio of gross wins to gross losses."""
    closed = [t for t in trades if t.get("pnl") is not None]
    wins = sum(t["pnl"] for t in closed if t["pnl"] > 0)
    losses = abs(sum(t["pnl"] for t in closed if t["pnl"] < 0))
    if losses == 0:
        return float("inf") if wins > 0 else 0.0
    return wins / losses


def stop_hit_rate(trades: list[dict]) -> float:
    """Fraction of exits caused by stop-loss."""
    exits = [t for t in trades if t.get("exit_reason")]
    if not exits:
        return 0.0
    stops = sum(1 for t in exits if t["exit_reason"] == "stop_loss")
    return stops / len(exits)


def avg_holding_days(trades: list[dict]) -> float:
    """Average days held for closed trades."""
    closed = [t for t in trades if t.get("holding_days") is not None]
    if not closed:
        return 0.0
    return float(np.mean([t["holding_days"] for t in closed]))


def summarize(equity_curve: pd.Series, trades: list[dict], spy_curve: pd.Series | None = None) -> dict:
    """Produce a dict of portfolio metrics suitable for persistence."""
    if len(equity_curve) < 2:
        return {}

    returns = equity_curve.pct_change().dropna()
    total_return = (equity_curve.iloc[-1] / equity_curve.iloc[0] - 1) * 100

    spy_return = None
    alpha = None
    if spy_curve is not None and len(spy_curve) >= 2:
        spy_return = (spy_curve.iloc[-1] / spy_curve.iloc[0] - 1) * 100
        alpha = total_return - spy_return

    return {
        "total_return_pct": round(float(total_return), 4),
        "spy_return_pct": round(float(spy_return), 4) if spy_return is not None else None,
        "alpha_pct": round(float(alpha), 4) if alpha is not None else None,
        "sharpe": round(sharpe_ratio(returns), 4),
        "sortino": round(sortino_ratio(returns), 4),
        "max_drawdown_pct": round(max_drawdown(equity_curve) * 100, 4),
        "win_rate_pct": round(win_rate(trades) * 100, 4),
        "profit_factor": round(profit_factor(trades), 4) if profit_factor(trades) != float("inf") else None,
        "stop_hit_rate_pct": round(stop_hit_rate(trades) * 100, 4),
        "avg_hold_days": round(avg_holding_days(trades), 2),
        "trade_count": len([t for t in trades if t.get("pnl") is not None]),
    }
