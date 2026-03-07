"""Create Monet Agent's scheduled cron jobs on LangGraph Platform.

Schedule (Toronto time, weekdays only):
- 10:00 AM — Research + Analysis (scout the market)
- 1:00 PM  — Research + Analysis (midday update)
- 4:00 PM  — Research + Analysis + Trade Execution (end of day, can trade)
- Friday 4:00 PM — Full loop including Reflection (weekly review)

Note: Friday reflection is handled by the 4pm cron input — the agent checks
its own journal to see if it's Friday and adds reflection. We encode this
in the Friday cron message.

All times converted to UTC (EDT = UTC-4):
- 10 AM ET = 14:00 UTC
- 1 PM ET  = 17:00 UTC
- 4 PM ET  = 20:00 UTC
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
        "name": "Morning Scout (10 AM ET)",
        "schedule": "0 14 * * 1-5",
        "message": (
            "Run the morning research loop. Execute these phases only:\n\n"
            "1. **Research** — Read /skills/research/SKILL.md and execute the research phase\n"
            "2. **Analysis** — Read /skills/analysis/SKILL.md and analyze candidates from your research\n\n"
            "Do NOT execute trades. This is a scouting run — gather intelligence, "
            "update your watchlist and market outlook, and identify setups for later."
        ),
    },
    {
        "name": "Midday Update (1 PM ET)",
        "schedule": "0 17 * * 1-5",
        "message": (
            "Run the midday research loop. Execute these phases only:\n\n"
            "1. **Research** — Read /skills/research/SKILL.md and execute the research phase\n"
            "2. **Analysis** — Read /skills/analysis/SKILL.md and analyze candidates from your research\n\n"
            "Do NOT execute trades. This is a midday update — check for new developments, "
            "earnings surprises, or market shifts since this morning. Update your watchlist and outlook."
        ),
    },
    {
        "name": "End of Day Trading (4 PM ET, Mon-Thu)",
        "schedule": "0 20 * * 1-4",
        "message": (
            "Run the end-of-day trading loop. Execute these phases:\n\n"
            "1. **Research** — Read /skills/research/SKILL.md and do a quick check on market close conditions\n"
            "2. **Analysis** — Read /skills/analysis/SKILL.md and finalize analysis on top candidates\n"
            "3. **Trade Execution** — Read /skills/trade-execution/SKILL.md and decide whether to trade\n\n"
            "This is the only loop where you may execute trades. Remember: doing nothing is the default. "
            "Only trade if you have high conviction from today's research and analysis."
        ),
    },
    {
        "name": "Friday Close + Weekly Reflection (4 PM ET, Fri)",
        "schedule": "0 20 * * 5",
        "message": (
            "Run the Friday end-of-day loop with weekly reflection. Execute ALL phases:\n\n"
            "1. **Research** — Read /skills/research/SKILL.md and review end-of-week market conditions\n"
            "2. **Analysis** — Read /skills/analysis/SKILL.md and finalize analysis\n"
            "3. **Trade Execution** — Read /skills/trade-execution/SKILL.md and decide whether to trade before the weekend\n"
            "4. **Reflection** — Read /skills/reflection/SKILL.md and do a FULL WEEKLY REVIEW:\n"
            "   - Review all trades from this week\n"
            "   - Compare outcomes to theses\n"
            "   - Calibrate your confidence scores (were your high-confidence trades better?)\n"
            "   - Update your strategy, market outlook, and risk appetite memories\n"
            "   - Write an honest assessment of what you learned this week\n\n"
            "This is your most important loop of the week. Take your time with the reflection."
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

    print("Done! All cron jobs configured.")


asyncio.run(main())
