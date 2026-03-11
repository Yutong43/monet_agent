"""Create Monet Agent's scheduled cron jobs on LangGraph Platform.

Unified trading loop + separate reflection:

Weekdays (Mon-Fri) — 3 runs/day = 15/week:
- 10:00 AM ET (14:00 UTC) — Full trading loop (research → analyze → decide)
- 1:00 PM ET  (17:00 UTC) — Full trading loop (research → analyze → decide)
- 4:00 PM ET  (20:00 UTC) — Reflection only (review, calibrate, recap)

Weekends — 1 run/day = 2/week:
- Sat 11:00 AM ET (15:00 UTC) — Full trading loop — weekend mode (deep dives, no execution)
- Sun 11:00 AM ET (15:00 UTC) — Weekly Review (performance, stage management, priorities)

All times EDT (UTC-4). Adjust for EST (UTC-5) when DST ends.
"""

import asyncio
import os

from dotenv import load_dotenv
from langgraph_sdk import get_client

load_dotenv()

LANGGRAPH_URL = "https://monet-0f211e9ce05255c2a85f92d6847873b5.us.langgraph.app"
LANGSMITH_API_KEY = os.environ["LANGSMITH_API_KEY"]


CRONS = [
    {
        "name": "Morning Trading Loop (10 AM ET, Mon-Fri)",
        "schedule": "0 14 * * 1-5",
        "message": (
            "Run the unified trading loop. Execute this phase:\n\n"
            "1. **Trading Loop** — Read /skills/trading-loop/SKILL.md and execute ALL steps (0-8)\n\n"
            "This is a full pass: market health → portfolio check → discovery → "
            "deep research → analysis → price targets → decision gate → record.\n\n"
            "Adjust depth based on your current agent_stage (explore/balanced/exploit).\n\n"
            "When writing journal entries, set run_source='trading_loop'."
        ),
    },
    {
        "name": "Midday Trading Loop (1 PM ET, Mon-Fri)",
        "schedule": "0 17 * * 1-5",
        "message": (
            "Run the unified trading loop. Execute this phase:\n\n"
            "1. **Trading Loop** — Read /skills/trading-loop/SKILL.md and execute ALL steps (0-8)\n\n"
            "This is a full pass: market health → portfolio check → discovery → "
            "deep research → analysis → price targets → decision gate → record.\n\n"
            "IMPORTANT: Start by loading all memory and recent journal entries so you "
            "build on the morning's work instead of repeating it.\n\n"
            "When writing journal entries, set run_source='trading_loop'."
        ),
    },
    {
        "name": "End of Day Reflection (4 PM ET, Mon-Fri)",
        "schedule": "0 20 * * 1-5",
        "message": (
            "Run the end-of-day reflection. Execute this phase:\n\n"
            "1. **Reflection** — Read /skills/reflection/SKILL.md and execute ALL steps\n\n"
            "This is a lightweight review — NO research, NO trading. Focus on:\n"
            "- Reviewing today's decisions and their outcomes\n"
            "- Confidence calibration\n"
            "- Updating beliefs and risk appetite\n"
            "- Cleaning up stale orders and watchlist\n"
            "- Updating stage counters\n"
            "- Sending daily recap (LAST STEP)\n\n"
            "When writing journal entries, set run_source='eod_reflection'."
        ),
    },
    {
        "name": "Saturday Trading Loop — Weekend Mode (11 AM ET, Sat)",
        "schedule": "0 15 * * 6",
        "message": (
            "Run the Saturday weekend trading loop. Execute this phase:\n\n"
            "1. **Trading Loop** — Read /skills/trading-loop/SKILL.md and execute ALL steps (0-8)\n\n"
            "This is the WEEKEND variant:\n"
            "- Target 3-5 deep dives (more than weekday runs)\n"
            "- Run sector analysis with longer periods (3mo AND 6mo)\n"
            "- NO trade execution (market is closed) — record all decisions as WAIT\n"
            "- Focus on building deep knowledge and sector-level thesis\n\n"
            "Take your time — markets are closed. Depth over speed.\n\n"
            "When writing journal entries, set run_source='trading_loop_weekend'."
        ),
    },
    {
        "name": "Sunday Weekly Review (11 AM ET, Sun)",
        "schedule": "0 15 * * 0",
        "message": (
            "Run the Sunday weekly review. Execute this phase:\n\n"
            "1. **Weekly Review** — Read /skills/weekly-review/SKILL.md\n"
            "   - Full portfolio performance review\n"
            "   - Trade win/loss analysis and confidence calibration\n"
            "   - Strategy assessment: what's working, what's not\n"
            "   - Stage management: update counters, check transition thresholds\n"
            "   - Set 3-5 specific priorities for the coming week\n"
            "   - Write comprehensive weekly reflection journal entry\n\n"
            "This is your most important session of the week. Be thorough and honest.\n\n"
            "When writing journal entries, set run_source='weekly_review'."
        ),
    },
]


async def main():
    client = get_client(
        url=LANGGRAPH_URL,
        api_key=LANGSMITH_API_KEY,
    )

    # Delete existing crons first
    existing = await client.crons.search()
    for c in existing:
        await client.crons.delete(c["cron_id"])
        print(f"Deleted existing cron: {c['cron_id']} (schedule: {c['schedule']})")

    if existing:
        print()

    # Create new crons
    for cron_def in CRONS:
        cron = await client.crons.create(
            assistant_id="autonomous_loop",
            schedule=cron_def["schedule"],
            input={
                "messages": [
                    {
                        "role": "user",
                        "content": cron_def["message"],
                    }
                ]
            },
        )
        print(f"Created: {cron_def['name']}")
        print(f"  Cron ID:  {cron['cron_id']}")
        print(f"  Schedule: {cron['schedule']}")
        print(f"  Next run: {cron.get('next_run_date')}")
        print()

    print(f"Done! {len(CRONS)} cron jobs configured (17 runs/week).")


asyncio.run(main())
