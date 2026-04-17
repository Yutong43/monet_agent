"""Check today's autonomous agent cron runs on LangGraph Platform.

This script:
1. Lists all configured cron jobs
2. Displays next scheduled run times
3. Shows recommended Supabase queries to verify run execution
4. Helps diagnose if today's runs completed successfully

Usage:
    python scripts/check_cron_runs.py

Expected EDT schedule for 2026-04-01 (Wednesday):
    10am EDT (14:00 UTC) — Morning Factor Loop
    1pm EDT (17:00 UTC) — Midday Factor Loop
    4pm EDT (20:00 UTC) — EOD Reflection
"""

import asyncio
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from langgraph_sdk import get_client

load_dotenv()

LANGGRAPH_URL = "https://monet-0f211e9ce05255c2a85f92d6847873b5.us.langgraph.app"
LANGSMITH_API_KEY = os.environ.get("LANGSMITH_API_KEY")

if not LANGSMITH_API_KEY:
    print("ERROR: LANGSMITH_API_KEY not found in .env")
    exit(1)


async def main():
    try:
        client = get_client(
            url=LANGGRAPH_URL,
            api_key=LANGSMITH_API_KEY,
        )

        print("\n" + "=" * 90)
        print("MONET AUTONOMOUS RUN DIAGNOSTICS")
        print("=" * 90)
        print(f"\nQuery time: {datetime.now(timezone.utc).isoformat()}")
        print(f"\nExpected EDT schedule for 2026-04-01 (Wednesday):")
        print("  10:00 AM EDT (14:00 UTC) — Morning Factor Loop")
        print("  1:00 PM EDT (17:00 UTC) — Midday Factor Loop")
        print("  4:00 PM EDT (20:00 UTC) — EOD Reflection")

        print("\n" + "=" * 90)
        print("CONFIGURED CRON JOBS")
        print("=" * 90)

        # Get all crons
        crons = await client.crons.list()
        if not crons:
            print("\nNo crons found!")
        else:
            print(f"\nFound {len(crons)} cron jobs:\n")
            for i, cron in enumerate(crons, 1):
                print(f"{i}. {cron.get('name', 'Unknown')}")
                print(f"   Schedule: {cron.get('schedule', 'unknown')}")
                print(f"   Status: {cron.get('status', 'unknown')}")
                if cron.get('next_run_date'):
                    print(f"   Next run: {cron['next_run_date']}")
                if cron.get('cron_id'):
                    print(f"   Cron ID: {cron['cron_id']}")
                print()

    except Exception as e:
        print(f"\nERROR connecting to LangGraph Platform: {e}")
        print("Check that LANGSMITH_API_KEY is valid and the URL is reachable")
        exit(1)

    print("=" * 90)
    print("HOW TO CHECK IF RUNS EXECUTED TODAY")
    print("=" * 90)
    print("""
The cron jobs run on the LangGraph Platform, which internally triggers the agent
via the 'autonomous_loop' assistant. To verify execution and check results:

A. CHECK SUPABASE DATABASE (most comprehensive):

1. Today's journal entries (should have 2-3 entries if runs succeeded):
   SELECT entry_type, title, symbols, run_source, created_at, content 
   FROM agent_journal 
   WHERE created_at >= DATE('2026-04-01') 
   ORDER BY created_at DESC;
   
   Expected entries:
   - run_source='factor_loop' at ~10am EDT
   - run_source='factor_loop' at ~1pm EDT
   - run_source='eod_reflection' at ~4pm EDT

2. Check factor rankings memory (updated by each factor loop):
   SELECT value->>'scored_at' as scored_at 
   FROM agent_memory 
   WHERE key = 'factor_rankings';

3. Check market regime (updated in Step 1 of factor loop):
   SELECT value->>'vix' as vix, value->>'breadth_pct' as breadth 
   FROM agent_memory 
   WHERE key = 'market_regime';

4. Check if trades were executed:
   SELECT symbol, side, quantity, status, created_at, thesis, confidence 
   FROM trades 
   WHERE created_at >= DATE('2026-04-01') 
   ORDER BY created_at DESC;

5. Check daily equity snapshot (created by EOD reflection):
   SELECT snapshot_date, portfolio_equity, portfolio_cash, spy_close, alpha, deployed_pct
   FROM equity_snapshots 
   WHERE snapshot_date = '2026-04-01';

6. Check memory updates to see activity timestamps:
   SELECT key, updated_at, length(value::text) as value_size 
   FROM agent_memory 
   WHERE updated_at >= DATE('2026-04-01') 
   ORDER BY updated_at DESC;

B. CHECK LANGGRAPH PLATFORM (via API):

To query specific runs programmatically:

from langgraph_sdk import get_client

client = get_client(
    url="https://monet-0f211e9ce05255c2a85f92d6847873b5.us.langgraph.app",
    api_key=os.environ["LANGSMITH_API_KEY"]
)

# List all crons
crons = await client.crons.list()

# Get run status for a specific thread (if you have the thread ID)
runs = await client.runs.list(thread_id="<thread_id>")

C. COMMON ISSUES TO CHECK:

1. Cron jobs not running at all:
   - Check if LANGSMITH_API_KEY has correct permissions
   - Verify the schedule is in UTC (14:00, 17:00, 20:00 UTC = 10am, 1pm, 4pm EDT)
   - Check if crons are ENABLED (status != "disabled")

2. Runs started but didn't complete:
   - Check LLM logs for errors
   - Verify Supabase connection is working
   - Check if tool errors are being caught (retry_middleware should handle transient errors)

3. Runs completed but didn't update journal:
   - Check if write_journal() is being called correctly
   - Verify journal entries are in Supabase (not just logged to stdout)

4. Factor rankings not updated:
   - Factor loop must reach Step 5 to save rankings
   - Check if score_universe() cached result (4-hour TTL) — if so, 'scored_at' may be old

5. No equity snapshot:
   - EOD reflection must call record_daily_snapshot() in Step 2
   - Check if snapshot was recorded for the correct date
    """)

    print("=" * 90)
    print()


asyncio.run(main())
