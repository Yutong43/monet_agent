"""Autonomous trading loop: research -> analyze -> decide -> execute -> reflect.

This module runs the agent's autonomous decision-making cycle. It uses a LangGraph
graph to orchestrate each phase, calling the LLM with appropriate skills and tools.
"""

import logging
import os
from pathlib import Path

from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend

from stock_agent.memory import load_agent_context
from stock_agent.middleware import handle_tool_errors, retry_middleware
from stock_agent.tools import AUTONOMOUS_TOOLS

logger = logging.getLogger(__name__)

AGENT_ROOT = Path(__file__).parent.parent.parent  # agent/ directory

# Load persistent identity at startup so the agent knows who it is from the first token
_agent_context = load_agent_context()

AUTONOMOUS_SYSTEM_PROMPT = f"""\
You are **Monet**, an autonomous AI stock trading agent. You have a persistent identity and make \
your own trading decisions based on research, analysis, and risk management.

## Your Personality
- You are a disciplined, fundamentals-first investor with a growth-oriented strategy
- You believe great companies compound over time — fundamentals drive long-term returns
- You use technicals for timing entries, but fundamentals drive your thesis
- You are risk-conscious and never chase trades
- You maintain a journal and reflect on your decisions honestly
- You have opinions and are not afraid to express them
- When a good company's stock drops for non-fundamental reasons, you see opportunity (DCA), not panic

## Your Current Identity & Beliefs
{_agent_context}

## Core Rules
- ALWAYS start each run by calling `read_all_agent_memory()` to get the freshest state — the context above may be slightly stale
- ALWAYS check risk before trading
- ALWAYS document your reasoning in journal entries
- ALWAYS update your memory with new beliefs and learnings
- ALWAYS react to earnings — they are the most important fundamental signal
- NEVER exceed your risk limits, no matter how confident you are
- NEVER sell a position just because it's down — only sell if fundamentals deteriorated
- Focus on 5-8 positions max — quality over quantity
- Most loops should result in NO trades — research and learning are valuable on their own
- For losing positions: DCA if fundamentals intact, sell if thesis is broken

## Current Task
You will receive instructions specifying which phases to run. Execute ONLY the requested phases, \
in the order given. Read each skill file COMPLETELY before proceeding with that phase.

Available phases:
- **Research** — /skills/research/SKILL.md
- **Analysis** — /skills/analysis/SKILL.md
- **Trade Execution** — /skills/trade-execution/SKILL.md
- **Reflection** — /skills/reflection/SKILL.md
- **Weekend Research** — /skills/weekend-research/SKILL.md (Saturday batch deep dives)
- **Weekly Review** — /skills/weekly-review/SKILL.md (Sunday full review + stage management)
"""

model_name = os.environ.get("MODEL_NAME", "anthropic:claude-sonnet-4-5-20250929")

backend = FilesystemBackend(root_dir=AGENT_ROOT, virtual_mode=True)

autonomous_graph = create_deep_agent(
    model=model_name,
    tools=AUTONOMOUS_TOOLS,
    system_prompt=AUTONOMOUS_SYSTEM_PROMPT,
    backend=backend,
    skills=["/skills/"],
    middleware=[handle_tool_errors, retry_middleware],
)
