# Price Alert Check (Lightweight)

You are running a **lightweight price check** between full trading loops. This should be FAST — minimize token usage. No research, no analysis, no screening.

## Step 1: Check Alerts

Call `check_watchlist_alerts(threshold_pct=2.0)` to scan all watchlist stocks against their target_entry prices.

- If `count: 0` → No stocks near targets. Write a one-line response and EXIT immediately. Do NOT proceed to further steps.

## Step 2: Evaluate Alerts (only if alerts found)

For each alerted stock:
1. Load its `stock:{SYMBOL}` memory for thesis and confidence
2. Check `get_open_orders()` — if there's already an open order for this symbol, skip it
3. Check confidence against stage threshold (explore: 0.80, balanced/exploit: 0.60)
4. If confidence is below threshold → skip, note in response

## Step 3: Execute (only for stocks passing Step 2)

For stocks that pass:
1. Run `check_trade_risk(symbol, "buy", quantity)` — if fail, skip
2. Determine order type using conviction-based logic:
   - 0.85+ confidence → market order
   - 0.70-0.85 → limit 1% below current
   - 0.60-0.70 → limit at target_entry
3. **Use bracket order**: Provide `take_profit_price` (from target_exit) and `stop_loss_price` (5% below entry)
4. Place order via `place_order()`
5. Record via `record_decision()`

## Step 4: Journal (only if actions taken)

Write a brief journal entry of type "trade" with:
- Which alerts fired
- Actions taken (or why you passed)
- Set `run_source='price_alert'`

## Rules
- This is a SPEED check. Do NOT research, screen, or analyze.
- Do NOT call market_breadth, sector_analysis, or any research tools.
- If no alerts → exit in under 500 tokens.
- Trust the thesis and confidence already stored in `stock:{SYMBOL}` memory — it was set during a full trading loop.
