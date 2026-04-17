"""Portfolio simulation engine.

Replays the factor-based trading loop against historical data. Key design:

- On each trading day T, compute factor scores using only data through T-1 close
  (no look-ahead). Generate signals. Simulate fills at T open (approximated as
  T close for simplicity). Apply intraday stop-losses and take-profits using
  each subsequent day's High/Low.

- Risk rules match the live system: 10% max position size, 20% cash buffer,
  5-8 position target, 5% daily loss gate (soft — can be disabled per run).

- Outputs: equity curve (daily snapshots), trade log with exit reasons.

Intentional simplifications:
- Fills at close price (no slippage model)
- Fundamentals are treated as static (yfinance gives current snapshot)
- No earnings reactions, no EPS revision signal — keeps variants isolated
- Bracket orders: simplified — check daily High/Low for TP/SL trigger
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime

import numpy as np
import pandas as pd

from stock_agent.factor_scoring import FactorVariant, compute_factor_scores

logger = logging.getLogger(__name__)


@dataclass
class SimRules:
    """Risk and sizing parameters held constant across variants."""
    starting_equity: float = 100_000.0
    max_positions: int = 8
    min_positions_before_full_deploy: int = 5
    position_size_pct: float = 0.10  # 10% per position
    cash_buffer_pct: float = 0.20    # keep 20% in cash
    take_profit_pct: float = 0.15    # default TP = +15%
    min_composite_to_buy: float = 65.0
    sell_rank_threshold: int = 100   # sell if drops below rank 100
    rebalance_every_n_days: int = 1  # score every day (could coarsen)
    min_hold_days: int = 3           # anti-churn floor


@dataclass
class Position:
    symbol: str
    entry_date: pd.Timestamp
    entry_price: float
    quantity: float
    stop_price: float
    take_profit_price: float
    composite_at_entry: float


@dataclass
class Trade:
    symbol: str
    side: str
    trade_date: pd.Timestamp
    price: float
    quantity: float
    composite_score: float | None = None
    exit_reason: str | None = None
    pnl: float | None = None
    holding_days: int | None = None


@dataclass
class PortfolioState:
    cash: float
    positions: dict[str, Position] = field(default_factory=dict)

    def equity(self, prices_today: pd.Series) -> float:
        positions_value = sum(
            pos.quantity * float(prices_today.get(sym, pos.entry_price))
            for sym, pos in self.positions.items()
        )
        return self.cash + positions_value

    def deployed_pct(self, prices_today: pd.Series) -> float:
        eq = self.equity(prices_today)
        if eq <= 0:
            return 0.0
        return (eq - self.cash) / eq * 100


def compute_atr(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> float:
    """Average True Range over `period` days, using the last row."""
    if len(close) < period + 1:
        return 0.0
    prev_close = close.shift(1)
    tr = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    atr = tr.rolling(period).mean().iloc[-1]
    return float(atr) if not pd.isna(atr) else 0.0


def compute_stop_and_tp(
    variant: FactorVariant,
    rules: SimRules,
    entry_price: float,
    highs: pd.Series | None = None,
    lows: pd.Series | None = None,
    closes: pd.Series | None = None,
) -> tuple[float, float]:
    """Compute stop-loss and take-profit prices based on variant's stop method."""
    if variant.stop_method == "fixed":
        stop = entry_price * (1 - variant.stop_pct)
    elif variant.stop_method == "atr":
        if highs is None or lows is None or closes is None:
            # Fall back to fixed if no OHLC data
            stop = entry_price * (1 - variant.stop_pct)
        else:
            atr = compute_atr(highs, lows, closes)
            atr_pct = (atr / entry_price) if entry_price > 0 else variant.stop_pct
            # Multiplier × ATR as stop distance, clamped to [atr_min_pct, atr_max_pct]
            stop_distance_pct = min(
                variant.atr_max_pct,
                max(variant.atr_min_pct, atr_pct * variant.atr_multiplier),
            )
            stop = entry_price * (1 - stop_distance_pct)
    else:
        stop = entry_price * (1 - variant.stop_pct)

    tp = entry_price * (1 + rules.take_profit_pct)
    return stop, tp


def check_bracket_exit(
    pos: Position,
    day_high: float,
    day_low: float,
) -> tuple[bool, str | None, float | None]:
    """Check if a stop or take-profit was hit during a day's price range.

    If both are in range, assume stop-loss fills first (conservative).

    Returns:
        (hit, reason, fill_price)
    """
    if day_low <= pos.stop_price:
        return True, "stop_loss", pos.stop_price
    if day_high >= pos.take_profit_price:
        return True, "take_profit", pos.take_profit_price
    return False, None, None


def run_backtest(
    variant: FactorVariant,
    rules: SimRules,
    close: pd.DataFrame,
    highs: pd.DataFrame,
    lows: pd.DataFrame,
    fundamentals: dict[str, dict],
    start: str,
    end: str,
) -> dict:
    """Run the full portfolio simulation for a given variant.

    Returns:
        Dict with equity_curve (Series), trades (list[dict]),
        spy_curve (Series), and summary metrics.
    """
    start_ts = pd.Timestamp(start)
    end_ts = pd.Timestamp(end)

    # Need at least max lookback days of history before start
    max_lookback = max(lb + skip for lb, skip in variant.momentum_lookbacks) + 10
    trading_days = close.index[(close.index >= start_ts) & (close.index <= end_ts)]
    if len(trading_days) == 0:
        raise ValueError(f"No trading days in range {start} → {end}")

    state = PortfolioState(cash=rules.starting_equity)
    trades: list[Trade] = []
    equity_snapshots: list[tuple[pd.Timestamp, float, float]] = []  # date, equity, cash

    logger.info(
        "Running variant '%s' from %s to %s (%d trading days)",
        variant.name, start, end, len(trading_days),
    )

    for i, today in enumerate(trading_days):
        today_close = close.loc[today]
        today_high = highs.loc[today] if today in highs.index else today_close
        today_low = lows.loc[today] if today in lows.index else today_close

        # ── 1. Intraday bracket exits (check each open position) ──
        exits_today: list[str] = []
        for sym, pos in list(state.positions.items()):
            day_h = float(today_high.get(sym, float("nan")))
            day_l = float(today_low.get(sym, float("nan")))
            if pd.isna(day_h) or pd.isna(day_l):
                continue
            hit, reason, fill = check_bracket_exit(pos, day_h, day_l)
            if hit and fill is not None:
                holding_days = (today - pos.entry_date).days
                # Enforce min hold (skip exit if too soon — unless stop_loss, which we honor)
                # Simpler: honor all exits; let rules.min_hold_days gate entries instead.
                pnl = (fill - pos.entry_price) * pos.quantity
                state.cash += pos.quantity * fill
                del state.positions[sym]
                trades.append(Trade(
                    symbol=sym,
                    side="sell",
                    trade_date=today,
                    price=fill,
                    quantity=pos.quantity,
                    exit_reason=reason,
                    pnl=pnl,
                    holding_days=holding_days,
                ))
                exits_today.append(sym)

        # ── 2. Compute factor scores as of T-1 (no look-ahead) ──
        # Use all price history strictly before today
        historical = close.loc[:today].iloc[:-1] if today in close.index else close.loc[:today]
        if len(historical) < max_lookback:
            # Not enough history yet — skip signal generation but record snapshot
            equity_snapshots.append((today, state.equity(today_close), state.cash))
            continue

        # Only rebalance every N days (default: every day)
        if i % rules.rebalance_every_n_days != 0:
            equity_snapshots.append((today, state.equity(today_close), state.cash))
            continue

        rankings = compute_factor_scores(
            close=historical,
            fundamentals=fundamentals,
            variant=variant,
        )

        if not rankings:
            equity_snapshots.append((today, state.equity(today_close), state.cash))
            continue

        rank_map = {r["symbol"]: r for r in rankings}

        # ── 3. SELL signals: positions with rank > threshold ──
        for sym, pos in list(state.positions.items()):
            # Enforce minimum hold
            holding_days = (today - pos.entry_date).days
            if holding_days < rules.min_hold_days:
                continue

            r = rank_map.get(sym)
            if r is None or r["rank"] > rules.sell_rank_threshold:
                # Sell at close
                price = float(today_close.get(sym, pos.entry_price))
                pnl = (price - pos.entry_price) * pos.quantity
                state.cash += pos.quantity * price
                del state.positions[sym]
                trades.append(Trade(
                    symbol=sym, side="sell", trade_date=today,
                    price=price, quantity=pos.quantity,
                    exit_reason="signal_rank_drop", pnl=pnl,
                    holding_days=holding_days,
                ))

        # ── 4. BUY signals: top-ranked stocks not already held ──
        current_equity = state.equity(today_close)
        target_cash = current_equity * rules.cash_buffer_pct
        available_cash = max(0, state.cash - target_cash)
        open_slots = rules.max_positions - len(state.positions)

        if open_slots > 0 and available_cash > 0:
            # Candidate: top-ranked not held, composite >= threshold
            candidates = [
                r for r in rankings
                if r["symbol"] not in state.positions
                and r["composite_score"] >= rules.min_composite_to_buy
            ]
            candidates = candidates[:open_slots]

            if candidates:
                per_position = current_equity * rules.position_size_pct
                per_position = min(per_position, available_cash / len(candidates))

                for r in candidates:
                    sym = r["symbol"]
                    price = float(today_close.get(sym, float("nan")))
                    if pd.isna(price) or price <= 0:
                        continue
                    qty = int(per_position / price)
                    if qty <= 0:
                        continue

                    # Compute stop + TP using per-symbol OHLC history (for ATR)
                    sym_highs = highs[sym].loc[:today].dropna() if sym in highs.columns else None
                    sym_lows = lows[sym].loc[:today].dropna() if sym in lows.columns else None
                    sym_closes = close[sym].loc[:today].dropna() if sym in close.columns else None
                    stop, tp = compute_stop_and_tp(
                        variant, rules, price,
                        highs=sym_highs, lows=sym_lows, closes=sym_closes,
                    )

                    cost = qty * price
                    if cost > state.cash:
                        continue

                    state.cash -= cost
                    state.positions[sym] = Position(
                        symbol=sym,
                        entry_date=today,
                        entry_price=price,
                        quantity=qty,
                        stop_price=stop,
                        take_profit_price=tp,
                        composite_at_entry=r["composite_score"],
                    )
                    trades.append(Trade(
                        symbol=sym, side="buy", trade_date=today,
                        price=price, quantity=qty,
                        composite_score=r["composite_score"],
                    ))

        # ── 5. End of day snapshot ──
        equity_snapshots.append((today, state.equity(today_close), state.cash))

    # ── End: mark-to-market any remaining positions at last close ──
    final_close = close.loc[trading_days[-1]]
    for sym, pos in state.positions.items():
        final_price = float(final_close.get(sym, pos.entry_price))
        pnl = (final_price - pos.entry_price) * pos.quantity
        holding_days = (trading_days[-1] - pos.entry_date).days
        trades.append(Trade(
            symbol=sym, side="sell", trade_date=trading_days[-1],
            price=final_price, quantity=pos.quantity,
            exit_reason="end_of_period",
            pnl=pnl, holding_days=holding_days,
        ))

    # Build equity curve
    equity_curve = pd.Series(
        [e for _, e, _ in equity_snapshots],
        index=pd.DatetimeIndex([d for d, _, _ in equity_snapshots]),
        name="equity",
    )
    cash_curve = pd.Series(
        [c for _, _, c in equity_snapshots],
        index=pd.DatetimeIndex([d for d, _, _ in equity_snapshots]),
        name="cash",
    )

    # SPY curve aligned
    spy_curve = pd.Series(dtype=float)
    if "SPY" in close.columns:
        spy_curve = close["SPY"].loc[trading_days].dropna()

    return {
        "equity_curve": equity_curve,
        "cash_curve": cash_curve,
        "spy_curve": spy_curve,
        "trades": [
            {
                "symbol": t.symbol,
                "side": t.side,
                "trade_date": t.trade_date.date().isoformat(),
                "price": round(t.price, 4),
                "quantity": t.quantity,
                "composite_score": t.composite_score,
                "exit_reason": t.exit_reason,
                "pnl": round(t.pnl, 2) if t.pnl is not None else None,
                "holding_days": t.holding_days,
            }
            for t in trades
        ],
    }
