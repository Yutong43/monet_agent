"""One-time migration: convert legacy memory keys to structured format.

Migrations:
- market_outlook → market_regime (best-effort extraction)
- watchlist_rationale_{SYMBOL} + company_profile_{SYMBOL} → stock:{SYMBOL}
- Reads watchlist table for target_entry/target_exit to populate stock:* entries

Keys left unchanged: strategy, agent_stage, risk_appetite, upcoming_earnings
"""

import logging
import os
import re
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

# Must import after dotenv
from stock_agent.db import read_all_memory, read_memory, write_memory, get_watchlist

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)


def migrate_market_regime():
    """Convert market_outlook to structured market_regime if not already present."""
    existing = read_memory("market_regime")
    if existing:
        log.info("market_regime already exists, skipping.")
        return

    outlook = read_memory("market_outlook")
    if not outlook:
        log.info("No market_outlook to migrate.")
        return

    val = outlook["value"]
    text = str(val.get("summary", val) if isinstance(val, dict) else val).lower()

    # Best-effort extraction
    vix = _extract_number(text, r"vix[:\s]+(\d+\.?\d*)")
    breadth = _extract_number(text, r"breadth[:\s]+(\d+\.?\d*)%?")

    # Infer regime from keywords
    regime_label = "transitional"
    if any(w in text for w in ("bull", "healthy", "strong", "risk-on")):
        regime_label = "healthy-bull"
    elif any(w in text for w in ("bear", "weak", "risk-off", "selloff")):
        regime_label = "broad-weakness"

    rotation = "mixed"
    if "risk-on" in text:
        rotation = "risk-on"
    elif "risk-off" in text:
        rotation = "risk-off"

    value = {
        "vix": vix or 0,
        "breadth_pct": breadth or 0,
        "rotation_signal": rotation,
        "regime_label": regime_label,
        "confidence": 0.5,  # Low confidence since this is extracted from prose
        "as_of": datetime.now().strftime("%Y-%m-%d %I:%M %p"),
        "migrated_from": "market_outlook",
    }
    write_memory("market_regime", value)
    log.info("Migrated market_outlook → market_regime: %s", regime_label)


def migrate_stock_analyses():
    """Combine watchlist_rationale_* + company_profile_* + watchlist targets into stock:* keys."""
    all_mem = read_all_memory()
    mem_by_key = {m["key"]: m for m in all_mem}

    # Get watchlist targets
    watchlist = get_watchlist()
    targets_by_symbol = {w["symbol"]: w for w in watchlist}

    # Find all symbols that have rationale or profile
    symbols = set()
    for m in all_mem:
        if m["key"].startswith("watchlist_rationale_"):
            symbols.add(m["key"].replace("watchlist_rationale_", ""))
        elif m["key"].startswith("company_profile_"):
            symbols.add(m["key"].replace("company_profile_", ""))

    migrated = 0
    skipped = 0
    for symbol in sorted(symbols):
        stock_key = f"stock:{symbol}"
        if stock_key in mem_by_key:
            log.info("  stock:%s already exists, skipping.", symbol)
            skipped += 1
            continue

        rationale = mem_by_key.get(f"watchlist_rationale_{symbol}", {}).get("value", {})
        profile = mem_by_key.get(f"company_profile_{symbol}", {}).get("value", {})
        wl = targets_by_symbol.get(symbol, {})

        # Build thesis from available sources
        thesis = ""
        if isinstance(rationale, dict):
            thesis = rationale.get("summary", rationale.get("thesis", str(rationale)))
        elif isinstance(rationale, str):
            thesis = rationale

        if not thesis and isinstance(profile, dict):
            thesis = profile.get("summary", profile.get("description", "Migrated from legacy profile"))

        value = {
            "symbol": symbol,
            "thesis": thesis[:500] if thesis else "Migrated — needs thesis update",
            "target_entry": wl.get("target_entry") or 0,
            "target_exit": wl.get("target_exit") or 0,
            "confidence": 0.5,  # Default since legacy didn't always store this
            "status": "watching",
            "target_set_date": datetime.now().strftime("%Y-%m-%d"),
            "regime_when_set": None,
            "last_analyzed": datetime.now().strftime("%Y-%m-%d %I:%M %p"),
            "migrated_from": "watchlist_rationale + company_profile",
        }

        # Try to extract confidence from rationale
        if isinstance(rationale, dict) and "confidence" in rationale:
            try:
                value["confidence"] = round(float(rationale["confidence"]), 2)
            except (TypeError, ValueError):
                pass

        # Try to pull bull/bear case from profile
        if isinstance(profile, dict):
            if "bull_case" in profile:
                value["bull_case"] = str(profile["bull_case"])[:300]
            if "bear_case" in profile:
                value["bear_case"] = str(profile["bear_case"])[:300]

        write_memory(stock_key, value)
        log.info("  Migrated stock:%s (thesis: %s...)", symbol, thesis[:60])
        migrated += 1

    log.info("Stock migration: %d migrated, %d skipped (already exist).", migrated, skipped)


def _extract_number(text: str, pattern: str) -> float | None:
    match = re.search(pattern, text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None


def main():
    log.info("=== Monet Memory Migration ===\n")

    log.info("1. Migrating market_outlook → market_regime")
    migrate_market_regime()

    log.info("\n2. Migrating watchlist_rationale_* + company_profile_* → stock:*")
    migrate_stock_analyses()

    log.info("\n=== Migration complete ===")
    log.info("Keys left unchanged: strategy, agent_stage, risk_appetite, upcoming_earnings")
    log.info("Legacy keys are NOT deleted — they'll be ignored by the new load_agent_context().")


if __name__ == "__main__":
    main()
