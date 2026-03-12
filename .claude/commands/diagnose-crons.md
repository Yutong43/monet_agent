# Diagnose Cron Jobs

Run a comprehensive diagnostic of the Monet Agent's autonomous cron job health. Check for errors, execution gaps, and propose improvements.

## Step 1: Check Cron Configuration

Query the LangGraph Platform for all registered crons:

```bash
cd agent && python -c "
import asyncio, os
from dotenv import load_dotenv
from langgraph_sdk import get_client

load_dotenv()

async def main():
    client = get_client(
        url='https://monet-0f211e9ce05255c2a85f92d6847873b5.us.langgraph.app',
        api_key=os.environ['LANGSMITH_API_KEY'],
    )
    crons = await client.crons.search()
    print(f'Total crons: {len(crons)} (expected: 5)')
    for c in crons:
        print(f'  Schedule: {c[\"schedule\"]}  |  Next: {c.get(\"next_run_date\", \"unknown\")}  |  ID: {c[\"cron_id\"]}')

asyncio.run(main())
"
```

Verify:
- There should be exactly **5 crons**: `0 14 * * 1-5`, `0 17 * * 1-5`, `0 20 * * 1-5`, `0 15 * * 6`, `0 15 * * 0`
- All `next_run_date` values should be in the future
- Flag any missing schedules

## Step 2: Check Recent Execution History

Query journal entries to see what actually ran:

```sql
SELECT
  DATE(created_at AT TIME ZONE 'America/New_York') as run_date,
  COUNT(*) as entries,
  ARRAY_AGG(DISTINCT entry_type) as types,
  MIN(created_at AT TIME ZONE 'America/New_York') as first_entry,
  MAX(created_at AT TIME ZONE 'America/New_York') as last_entry
FROM agent_journal
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(created_at AT TIME ZONE 'America/New_York')
ORDER BY run_date DESC;
```

Use `mcp__supabase__execute_sql` to run this query.

For each day, verify against the expected schedule:
- **Weekdays**: Should have 3 runs producing entries (research, analysis, trade/reflection)
- **Saturday**: Should have 1 run (weekend research + analysis)
- **Sunday**: Should have 1 run (weekly review / reflection)

Flag any **gaps** — days where expected runs are missing.

## Step 3: Check for Errors

Look for signs of failures:

```sql
SELECT
  entry_type,
  title,
  LEFT(content, 200) as content_preview,
  created_at AT TIME ZONE 'America/New_York' as et_time
FROM agent_journal
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND (
    content ILIKE '%error%'
    OR content ILIKE '%failed%'
    OR content ILIKE '%exception%'
    OR content ILIKE '%could not%'
    OR content ILIKE '%unable to%'
  )
ORDER BY created_at DESC;
```

Also check LangSmith traces for the `monet` project if errors are suspected but not journaled (the agent may have crashed before writing a journal entry).

## Step 4: Check Phase Completeness

For the last 7 days, verify each cron produced the expected outputs:

```sql
SELECT
  DATE(created_at AT TIME ZONE 'America/New_York') as run_date,
  entry_type,
  COUNT(*) as count
FROM agent_journal
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at AT TIME ZONE 'America/New_York'), entry_type
ORDER BY run_date DESC, entry_type;
```

Expected daily pattern (weekdays):
- Morning (10am): 1+ research entries
- Midday (1pm): 1+ research + 1+ analysis entries
- EOD (4pm): 1+ trade entries + 1+ reflection entries

Flag if any phase is consistently missing (e.g. always research but never reflection).

## Step 5: Check Memory Freshness

```sql
SELECT
  key,
  updated_at AT TIME ZONE 'America/New_York' as last_updated,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 as hours_ago
FROM agent_memory
WHERE key IN ('market_outlook', 'strategy', 'risk_appetite', 'agent_stage', 'weekly_priorities', 'upcoming_earnings')
ORDER BY updated_at DESC;
```

Flag:
- `market_outlook` not updated in 24h on a weekday → research phase isn't writing
- `weekly_priorities` not updated in 8 days → Sunday review isn't running
- `upcoming_earnings` missing → earnings_calendar tool never ran or failed to persist
- `agent_stage` missing → stage tracking not initialized

## Step 6: Check Tool Usage Patterns

```sql
SELECT
  entry_type,
  title,
  symbols,
  created_at AT TIME ZONE 'America/New_York' as et_time
FROM agent_journal
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;
```

Look for:
- Is the agent using `read_all_agent_memory()` at the start? (should mention loading context)
- Is it reacting to earnings? (look for earnings-related analysis entries)
- Is it setting price targets? (analysis entries should mention targets)
- Is it doing DCA analysis? (trade entries should assess fundamentals before selling)

## Step 7: Verification Checklist

Read `POSTDEPLOY_CHECK.md` at the project root. This file tracks pending feature verifications with specific trigger conditions.

For each item in the **Pending Verification** section:
1. Check if the trigger condition has been met (e.g. "MU reported earnings" or "first trading loop after deploy")
2. If yes, verify each checkbox by querying the database for evidence
3. Mark items as checked `[x]` if verified, or flag failures
4. Move fully verified sections to the **Verified** section with today's date
5. If a check fails, note what went wrong and propose a fix

Key queries for verification:
```sql
-- Check for earnings_reaction memories
SELECT key, value FROM agent_memory WHERE key LIKE 'earnings_reaction:%';

-- Check if eps_estimates was used (look for it in journal content)
SELECT title, content FROM agent_journal
WHERE content ILIKE '%eps_estimates%' OR content ILIKE '%estimate revision%'
ORDER BY created_at DESC LIMIT 5;

-- Check recap format
SELECT entry_type, title, LEFT(content, 300) FROM agent_journal
WHERE entry_type = 'reflection' AND created_at >= CURRENT_DATE
ORDER BY created_at DESC LIMIT 1;
```

Update the file with your findings — check off verified items, move completed sections, add new pending items if you discover untested behaviors.

## Step 8: Generate Report

**Include a Checklist Summary section in the report:**

Summarize findings in this structure:

### Health Score: X/10

### Cron Status
- [ ] All 5 crons registered
- [ ] Next run dates are correct
- [ ] No stale/orphaned crons

### Execution Gaps (last 14 days)
- List any dates where expected runs didn't happen
- Identify if gaps are systematic (e.g. weekends always missing) vs random

### Errors Found
- List any errors from journal content
- Note any days with 0 entries (possible crash before journaling)

### Phase Completeness
- Which phases are running consistently?
- Which phases are missing or under-represented?

### Memory Health
- Which memories are fresh vs stale?
- Any critical memories missing?

### Verification Checklist
- How many pending items were verifiable this run?
- How many passed vs failed?
- Any new items to add based on today's findings?
- List items moved to Verified

### Proposals
Based on findings, propose:
1. **Missing tools** — e.g. "Add a health-check tool that validates the agent's own execution"
2. **Skill improvements** — e.g. "Research phase should handle Finnhub rate limits more gracefully"
3. **Schedule adjustments** — e.g. "Add a pre-market check at 9:30am for position monitoring"
4. **Error recovery** — e.g. "Add retry logic for failed journal writes"
5. **Monitoring** — e.g. "Store run_metadata in journal to track which cron triggered each entry"
