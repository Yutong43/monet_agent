"""Send an ad-hoc message to Monet's autonomous loop.

Usage:
    # Default: order review prompt
    python scripts/send_message.py

    # Custom message
    python scripts/send_message.py "Check your portfolio and update market outlook"
"""

import asyncio
import os
import sys

from dotenv import load_dotenv
from langgraph_sdk import get_client

load_dotenv()

LANGGRAPH_URL = "https://monet-0f211e9ce05255c2a85f92d6847873b5.us.langgraph.app"
LANGSMITH_API_KEY = os.environ["LANGSMITH_API_KEY"]

ORDER_REVIEW_MESSAGE = """\
Review your current open orders and portfolio state. Execute these steps:

1. Run `get_open_orders()` to see all pending/accepted orders
2. Run `get_portfolio_state()` to see your current positions and cash
3. For each open order, evaluate:
   - Does this order still align with your current thesis and market view?
   - Has your analysis or reflection since placing it changed your mind?
   - Was it placed prematurely (before proper research)?
4. Cancel any orders you no longer believe in using `cancel_order(trade_id, reason="...")`
5. Write a journal entry summarizing what you kept, what you cancelled, and why

Be honest and decisive. Unfilled orders you regret are dead capital — cancel them \
and redeploy when the setup is right.
"""


async def main():
    message = sys.argv[1] if len(sys.argv) > 1 else ORDER_REVIEW_MESSAGE

    client = get_client(
        url=LANGGRAPH_URL,
        api_key=LANGSMITH_API_KEY,
    )

    # Create a new thread for this ad-hoc run
    thread = await client.threads.create()

    # Trigger the autonomous loop with our message
    run = await client.runs.create(
        thread_id=thread["thread_id"],
        assistant_id="autonomous_loop",
        input={
            "messages": [
                {
                    "role": "user",
                    "content": message,
                }
            ]
        },
    )

    print(f"Run triggered!")
    print(f"  Thread: {thread['thread_id']}")
    print(f"  Run ID: {run['run_id']}")
    print(f"  Status: {run['status']}")
    print(f"\nMessage sent:\n{message[:200]}{'...' if len(message) > 200 else ''}")

    # Poll until complete
    print("\nWaiting for completion...")
    while True:
        state = await client.runs.get(thread["thread_id"], run["run_id"])
        status = state["status"]
        if status in ("success", "error", "timeout", "interrupted"):
            print(f"  Final status: {status}")
            break
        await asyncio.sleep(5)
        print(f"  Status: {status}...")

    print("\nDone. Check the activity feed or journal for results.")


asyncio.run(main())
