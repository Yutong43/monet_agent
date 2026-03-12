# Verification Checklist

Ongoing checklist of features/behaviors to verify after deployment. When reviewing run quality, check pending items whose trigger conditions have been met.

---

## Pending Verification

### Post-Earnings Protocol (MU — March 19 morning run)
**Trigger**: MU reports earnings March 18 after market close. First 10am run on March 19 tests the new protocol.
- [ ] Agent treats MU as high-priority in Step 2 (not buried in normal flow)
- [ ] Runs `internet_search("MU earnings results Q2 2026")` for actual numbers
- [ ] Runs `eps_estimates("MU")` to check if forward estimates revised
- [ ] Runs `fundamental_analysis("MU")` for updated metrics
- [ ] Compares actual EPS to the `eps_estimate: 8.9747` from `upcoming_earnings` memory
- [ ] Writes structured `earnings_reaction:MU` memory with surprise_pct, guidance, thesis_impact
- [ ] Updates `stock:MU` confidence based on results
- [ ] If thesis broken → flags for SELL in Step 7
- [ ] If thesis strengthened → flags as BUY candidate in Step 7
- [ ] No new MU position opened in the 5 days before earnings (pre-earnings protocol)

### EPS Estimates Tool (next trading loop run)
**Trigger**: First trading loop run after March 11 deploy.
- [ ] `eps_estimates()` called during Step 5 for at least one analyzed stock
- [ ] Revision signal (rising/falling/flat) included in analysis reasoning
- [ ] EPS estimate trend factored into confidence score

### Daily Recap Format (next 4pm run)
**Trigger**: Next weekday 4pm reflection.
- [ ] Recap appears in chat tab under user's conversations
- [ ] First message shows clean user prompt (not raw SQL instructions)
- [ ] Recap is ~150 words, focused on market/research/trades/watchlist
- [ ] No self-reflection or verbose diary entries

### Dashboard Restructure (manual check)
**Trigger**: After Vercel redeploy.
- [ ] Dashboard shows 3 top cards (Performance, Lifecycle, Benchmark)
- [ ] Portfolio summary shows live Alpaca data (equity, cash, buying power, P&L)
- [ ] Positions table renders current holdings
- [ ] Benchmark card shows "—" with "X% deployed" when <50% deployed
- [ ] Watchlist and trades still display correctly
- [ ] About Me page has ReleaseLog in right sidebar (no more Performance/Lifecycle cards)

### Alpha Calculation Fix (accumulates over time)
**Trigger**: Once portfolio is >50% deployed.
- [ ] Alpha shows a real number instead of "—"
- [ ] `deployed_pct` column populated in equity_snapshots
- [ ] Alpha is reasonable (not -22% from cash drag)

---

## Verified (completed)

### Bracket Orders & Position Protection (March 11)
- [x] TSM position has bracket order (stop $335, target $410)
- [x] `position_health_check` reports `protected: true`

### Conviction-Based Orders (March 11)
- [x] TSM 0.845 confidence → market order (not limit 2% away)
- [x] MU/NVDA/LRCX below threshold → correctly waited

### Daily Recap Delivery (March 11)
- [x] `send_daily_recap` connects to LangGraph Platform (URL fix)
- [x] Thread created with correct user owner (auth fix)
- [x] Recap visible in chat conversation list

---

## How to Check Run Quality

```sql
-- Today's journal entries
SELECT entry_type, title, content, symbols, created_at
FROM agent_journal WHERE created_at >= CURRENT_DATE ORDER BY created_at;

-- Recent trades
SELECT symbol, side, quantity, order_type, limit_price, status, thesis, confidence
FROM trades WHERE created_at >= CURRENT_DATE ORDER BY created_at;

-- Structured memory updates
SELECT key, updated_at FROM agent_memory
WHERE updated_at >= CURRENT_DATE ORDER BY updated_at DESC;

-- Earnings tracking
SELECT value FROM agent_memory WHERE key = 'upcoming_earnings';
SELECT key, value FROM agent_memory WHERE key LIKE 'earnings_reaction:%';
```
