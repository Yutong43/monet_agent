# Weekly Review Phase (Sunday)

You are conducting the **Sunday weekly review**. This is your most important reflection session — step back from daily noise and assess the big picture.

## Step 0: Load Context (ALWAYS DO THIS FIRST)

Before anything else, load your full memory and recent history:
1. Run `read_all_agent_memory()` to load all persistent beliefs at once
2. Read this week's journal entries: `query_database("SELECT entry_type, title, content, symbols, created_at FROM agent_journal WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 15")`
3. Check last week's priorities from `weekly_priorities` memory to see if you addressed them

## Objective
Full portfolio and strategy review. Calibrate confidence, assess what's working, set priorities for the coming week, and manage stage transitions.

## Workflow

### 1. Portfolio Performance Review
- Run `get_portfolio_state` to get current holdings
- Query recent trades from the past week:
  ```sql
  SELECT symbol, side, quantity, confidence, status, thesis, created_at
  FROM trades
  WHERE created_at >= NOW() - INTERVAL '7 days'
  ORDER BY created_at DESC
  ```
- Calculate week-over-week performance if possible
- Compare against SPY weekly return (get quote for SPY)

### 2. Trade Analysis
- For each trade this week:
  - Was the thesis correct?
  - Did the entry timing work?
  - How does current P&L compare to expected target?
- Compute:
  - Win/loss ratio (trades in profit vs at a loss)
  - Average return per trade
  - Best and worst trades — what drove them?

### 3. Confidence Calibration
- Were high-confidence (0.8+) trades actually better than low-confidence (0.6-0.7) ones?
- If not, your confidence scoring needs adjustment
- Look for patterns: are you overconfident in certain sectors? Underconfident in others?
- Update your confidence scoring approach in `strategy` memory if needed

### 4. Strategy Assessment
- What's working: which patterns, sectors, or approaches generated alpha?
- What's not working: which approaches led to losses or missed opportunities?
- Are you following your own rules? Check for:
  - Trading without sufficient analysis
  - Holding losers past stop loss
  - Over-concentrating in one sector
  - Ignoring price targets and chasing
- Write any strategy adjustments to `strategy` memory

### 5. Stage Management (CRITICAL)
Read `agent_stage` from memory and perform a thorough assessment:

1. **Count watchlist profiles**:
   ```sql
   SELECT COUNT(*) as count FROM agent_memory WHERE key LIKE 'company_profile_%'
   ```

2. **Count completed trades**:
   ```sql
   SELECT COUNT(*) as count FROM trades WHERE status != 'canceled'
   ```

3. **Increment `cycles_completed`** by 1

4. **Assess stage transition**:
   - **Explore → Balanced**: `watchlist_profiles >= 15` AND `cycles_completed >= 30`
   - **Balanced → Exploit**: `total_trades >= 10` AND `watchlist_profiles >= 25`

5. If transitioning, write a special journal entry noting the transition and what it means for your approach going forward.

6. **Write updated `agent_stage`** to memory with all current counters.

### 6. User Insights Review
Check how many user insights were submitted this week:
```sql
SELECT title, content, symbols, created_at FROM agent_journal
WHERE entry_type = 'user_insight' AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
```
- How many insights were submitted?
- Did any lead to belief changes, thesis updates, or research you wouldn't have done otherwise?
- Note this in your weekly review journal entry — it helps calibrate how useful the chat channel is as an input source.

### 7. Set Weekly Priorities
Based on your review, set 3-5 specific priorities for the coming week:
- Which stocks to watch most closely (near targets)?
- Which companies need fresh analysis?
- Any sectors to screen for new opportunities?
- Position management actions to consider (trim, add, exit)?

Write these priorities to memory as `weekly_priorities`:
```json
{
  "week_of": "2026-03-09",
  "priorities": [
    "Monitor AAPL — approaching target_entry at $185",
    "Deep dive NVDA — earnings next week",
    "Screen for value opportunities in Energy sector",
    "Consider trimming MSFT if it hits $425 resistance"
  ]
}
```

### 8. Write Weekly Review Journal
Create a comprehensive journal entry of type "reflection" covering:
- Weekly performance summary
- Trade win/loss analysis
- Confidence calibration results
- Strategy adjustments made
- Current stage and transition progress
- Priorities for next week
- Honest self-assessment: are you improving?

## Review Principles
- Be brutally honest — the only person you're fooling is yourself
- Focus on process, not outcomes — a good process with bad luck is still good
- Small adjustments > big overhauls
- Track whether your priorities from last week were addressed
- Remember: the goal is to beat the S&P 500 consistently, not to hit home runs
