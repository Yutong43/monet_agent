# Autonomous Agent Run Diagnostics Guide

**Project**: Monet Stock Trading Agent  
**Today**: 2026-04-01 (Wednesday)  
**Time Zone**: EDT (UTC-4)  

## Expected Schedule for Today

Three scheduled runs via LangGraph Platform crons:

| Time | Schedule (UTC) | Cron | What Runs | Run Source |
|------|---|---|---|---|
| 10:00 AM EDT | 14:00 UTC | `0 14 * * 1-5` | **Factor Loop** (Step 0-5) | `factor_loop` |
| 1:00 PM EDT | 17:00 UTC | `0 17 * * 1-5` | **Factor Loop** (Step 0-5) | `factor_loop` |
| 4:00 PM EDT | 20:00 UTC | `0 20 * * 1-5` | **Reflection** (Step 1-7) | `eod_reflection` |

---

## How to Check Run Status

### Method 1: Check Cron Job Configuration (LangGraph Platform)

Run the diagnostic script:

```bash
cd agent && python scripts/check_cron_runs.py
```

This script:
- Connects to LangGraph Platform via `langgraph_sdk`
- Lists all configured crons
- Shows next scheduled run times
- Displays their status

**Key fields to check:**
- `status`: Should be "enabled" or similar (not "disabled")
- `schedule`: Should match UTC times (14:00, 17:00, 20:00)
- `next_run_date`: Shows when the next cron will trigger

### Method 2: Query Supabase for Run Results

Query the Supabase database to see if runs executed and what they produced.

#### A. Check Today's Journal Entries

```sql
SELECT entry_type, title, symbols, run_source, created_at, LENGTH(content) as content_length
FROM agent_journal 
WHERE created_at >= DATE('2026-04-01')
ORDER BY created_at DESC;
```

**Expected results** (if all runs completed):
- 2-3 journal entries with `run_source = 'factor_loop'` (10am and 1pm runs)
- 1 journal entry with `run_source = 'eod_reflection'` (4pm run)
- Times should be approximately 14:00, 17:00, and 20:00 UTC (or 10am, 1pm, 4pm EDT)

#### B. Check Factor Rankings Memory

Updated by each factor loop run in Step 5:

```sql
SELECT 
  (value->>'scored_at') as scored_at,
  (value->>'universe_size') as universe_size,
  jsonb_array_length(value->'top_10') as top_10_count,
  value->'factor_weights'::text as factor_weights
FROM agent_memory 
WHERE key = 'factor_rankings'
ORDER BY (value->>'scored_at') DESC
LIMIT 1;
```

**Expected:**
- `scored_at` should be recent (today's run time ± 5 minutes)
- `universe_size` should be ~900
- `top_10_count` should be 10
- Factor weights should sum to 1.0

#### C. Check Market Regime (Step 1 of Factor Loop)

```sql
SELECT 
  (value->>'vix') as vix,
  (value->>'breadth_pct')::float as breadth_pct,
  (value->>'regime') as regime,
  (value->>'updated_at') as updated_at
FROM agent_memory 
WHERE key = 'market_regime'
ORDER BY (value->>'updated_at') DESC
LIMIT 1;
```

**Expected:**
- `vix`: Current VIX level (e.g., 14.5)
- `breadth_pct`: Market breadth % (e.g., 68.5)
- `regime`: One of "normal", "warning", "critical"
- `updated_at`: Should be today's run time

#### D. Check Trades Executed

```sql
SELECT 
  symbol, side, quantity, order_type, status, limit_price, thesis, confidence, created_at
FROM trades 
WHERE created_at >= DATE('2026-04-01')
ORDER BY created_at DESC;
```

**Expected:**
- Some BUY or SELL orders placed during the runs
- Status: "pending", "accepted", or "filled"
- Confidence: Should be composite_score / 100 (0.0-1.0)
- Thesis: Brief factor-based rationale

#### E. Check Daily Equity Snapshot (4pm Reflection)

```sql
SELECT 
  snapshot_date, portfolio_equity, portfolio_cash, spy_close, alpha, deployed_pct,
  portfolio_cumulative_return, spy_cumulative_return
FROM equity_snapshots 
WHERE snapshot_date = '2026-04-01';
```

**Expected:**
- One row for 2026-04-01
- `portfolio_equity`: Current total equity value
- `spy_close`: SPY close price from market close
- `alpha`: Portfolio return - SPY return (only meaningful if deployed_pct > 50)
- `deployed_pct`: % of portfolio deployed (vs cash)

#### F. Check Memory Updates to See Activity

```sql
SELECT 
  key, updated_at, 
  (LENGTH(value::text)) as value_size_bytes,
  LEFT(value::text, 100) as value_preview
FROM agent_memory 
WHERE updated_at >= DATE('2026-04-01')
ORDER BY updated_at DESC;
```

**Expected:**
- Multiple updates throughout the day as runs execute
- `factor_rankings`: Updated twice (10am and 1pm factor loops)
- `market_regime`: Updated in Steps 1 of each run
- `ai_bubble_risk`: Updated in Step 1.5 of each run
- Various `stock:*` and `earnings_profile:*` keys updated

---

## Skill Definitions

The agent executes three main skills based on which phase is triggered:

### Factor Loop Skill (`agent/skills/factor-loop/SKILL.md`)

**When**: 10am and 1pm EDT (14:00, 17:00 UTC)  
**Steps**:
1. Load context (reconcile positions, read memory, load journal)
2. Market regime check (VIX, breadth, sector leadership)
3. Score universe (~150 stocks) → enrich EPS → generate signals
4. Earnings guard (skip BUYs within 5 days of earnings)
5. Execute signals (SELL then BUY in rank order)
6. Record (update stock analyses, save factor rankings, write journal)

**Key outputs**:
- `factor_rankings` memory (top 10, factor weights, scores)
- Trades executed (BUY/SELL orders)
- Journal entry with type "market_scan", `run_source='factor_loop'`
- Position health checks (bracket tightening)

### Reflection Skill (`agent/skills/reflection/SKILL.md`)

**When**: 4pm EDT (20:00 UTC)  
**Steps**:
1. Reconcile positions (check for bracket fills)
2. Record daily snapshot (portfolio equity vs SPY)
3. Review user insights
4. Update beliefs (risk appetite, clean up stale memories)
5. Cancel stale orders
6. Write reflection (position table, daily P&L, alpha vs SPY)
7. Send daily recap email

**Key outputs**:
- `equity_snapshots` row for today
- Journal entry with type "reflection", `run_source='eod_reflection'`
- Daily recap email sent to subscribers
- `risk_appetite` memory updated

---

## Autonomous Agent Architecture

### How It Works

1. **LangGraph Platform** hosts crons that fire at scheduled times
2. **Cron job** sends a message to the `autonomous_loop` assistant via the LangGraph API
3. **Message** specifies which skill to run (e.g., "Run Factor Loop Step 0-5")
4. **Agent** loads the skill from `agent/skills/<skill>/SKILL.md`
5. **Agent** executes using the autonomous system prompt (`agent/src/stock_agent/autonomy.py`)
6. **Tools** called by the agent interact with Supabase, Alpaca, Finnhub, etc.
7. **Results** written to agent_journal, agent_memory, trades, equity_snapshots tables

### Key Files

| File | Purpose |
|------|---------|
| `agent/scripts/create_crons.py` | Creates the 5 cron jobs on LangGraph Platform |
| `agent/scripts/check_cron_runs.py` | Queries platform to show cron configuration |
| `agent/src/stock_agent/autonomy.py` | Autonomous system prompt + graph definition |
| `agent/skills/factor-loop/SKILL.md` | Factor-based trading loop instructions |
| `agent/skills/reflection/SKILL.md` | EOD reflection instructions |
| `agent/src/stock_agent/db.py` | Database CRUD operations |
| `agent/src/stock_agent/tools.py` | Tool definitions (score_universe, place_order, etc.) |

### System Prompt

The autonomous agent is initialized with persistent identity context that includes:
- Current portfolio state
- Recent memory entries
- Trading rules and constraints
- Core rules (never exceed risk limits, react to earnings, etc.)

See the system prompt in `agent/src/stock_agent/autonomy.py` starting at line 25.

---

## Debugging Common Issues

### Issue: No journal entries for today

**Possible causes:**
1. Crons not enabled or configured incorrectly
2. Agent crashed during execution
3. write_journal() calls failing silently

**How to debug:**
```sql
-- Check if any memory was updated today (means agent is running)
SELECT key, updated_at FROM agent_memory 
WHERE updated_at >= DATE('2026-04-01') 
LIMIT 1;

-- Check LangGraph logs
-- (Would need access to platform dashboard)
```

### Issue: Trades not executing despite factor signals

**Possible causes:**
1. Risk checks blocking trades (VIX > 26, breadth < 30%)
2. Earnings guard blocking all BUY signals
3. Anti-churn rules preventing closes
4. place_order() tool failing

**How to debug:**
```sql
-- Check if signals were generated but not executed
SELECT * FROM agent_journal 
WHERE created_at >= DATE('2026-04-01')
  AND run_source = 'factor_loop'
  AND content LIKE '%HOLD%'
ORDER BY created_at DESC;

-- Check risk settings
SELECT * FROM risk_settings;

-- Check if risk checks are documented in journal
SELECT content FROM agent_journal
WHERE content LIKE '%REGIME GATE%' 
   OR content LIKE '%risk%'
ORDER BY created_at DESC LIMIT 5;
```

### Issue: Factor rankings not updated

**Possible causes:**
1. score_universe() hitting 4-hour cache (previous day's scores reused)
2. Agent didn't reach Step 5 (Record)
3. write_agent_memory() call failed

**How to debug:**
```sql
-- Check if factor_rankings exists and when it was last updated
SELECT 
  (value->>'scored_at')::timestamp as scored_at,
  NOW() - (value->>'scored_at')::timestamp as age
FROM agent_memory 
WHERE key = 'factor_rankings';

-- If scored_at is > 4 hours old, cache is being reused
-- Check journal to see if agent noted this
SELECT content FROM agent_journal
WHERE content LIKE '%cache%'
  AND created_at >= DATE('2026-04-01');
```

### Issue: Equity snapshot missing

**Possible cause:**
- 4pm reflection run didn't complete Step 2 (record_daily_snapshot)

**How to debug:**
```sql
-- Check if reflection journal entry exists
SELECT * FROM agent_journal
WHERE run_source = 'eod_reflection'
  AND created_at >= DATE('2026-04-01');

-- Check if record_daily_snapshot() was called
SELECT content FROM agent_journal
WHERE content LIKE '%snapshot%'
  AND created_at >= DATE('2026-04-01');

-- Check equity_snapshots table
SELECT * FROM equity_snapshots 
WHERE snapshot_date >= DATE('2026-04-01')
ORDER BY snapshot_date DESC;
```

---

## Performance Tips

### Interpreting Factor Scores

All factors are 0-100:
- **Momentum** (3m+12m returns): Trending up/down strength
- **Quality** (ROE, debt ratios): Company financial health
- **Value** (P/E, P/B ratios): Valuation relative to sector
- **EPS Revision** (analyst estimate changes): Buy/sell signal strength
- **Composite**: Weighted average of above (typically 40/30/20/10 or similar)

### Reading Journal Entries

Factor loop journals include:
- **Top 10 table**: Rank, Symbol, Composite Score, Momentum, Quality, Value, EPS Rev
- **Signals**: BUY (count), SELL (count), HOLD (count), WAIT (count)
- **Actions taken**: Orders placed, positions adjusted
- **Risk context**: VIX level, breadth %, regime

Reflection journals include:
- **Portfolio summary**: Equity, daily P&L, alpha vs SPY
- **Position table**: Current holdings with P&L and composite scores
- **Factor observations**: Notable outperformers/underperformers
- **Tomorrow's focus**: Key risks or opportunities

### Monitoring Performance

**Weekly check:**
- Alpha vs SPY accumulating correctly?
- Drawdown within acceptable bounds?
- Factor weights stable or converging?

**Daily check:**
- Journal entries present (crons firing)?
- Memory updated (agent is working)?
- Trades executing or blocked by risk?

---

## LangGraph SDK API Reference

The agent uses `langgraph_sdk` to interact with the platform:

```python
from langgraph_sdk import get_client

client = get_client(
    url="https://monet-0f211e9ce05255c2a85f92d6847873b5.us.langgraph.app",
    api_key=os.environ["LANGSMITH_API_KEY"]
)

# List all crons
crons = await client.crons.list()

# List all threads
threads = await client.threads.list()

# Get a specific thread's runs
runs = await client.runs.list(thread_id="...")

# Get run details
run = await client.runs.get(thread_id="...", run_id="...")

# Manually trigger a run
run = await client.runs.create(
    thread_id="...",
    assistant_id="autonomous_loop",
    input={"messages": [{"role": "user", "content": "..."}]}
)
```

See `agent/scripts/send_message.py` for a working example.

---

## Last Updated

- **Guide created**: 2026-04-01
- **Expected schedule verified**: Yes (create_crons.py shows correct UTC times)
- **Skills verified**: Yes (both SKILL.md files reviewed)
- **DB schema verified**: Yes (initial_schema.sql reviewed)
