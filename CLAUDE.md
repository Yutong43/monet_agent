# Monet Agent — Autonomous AI Investor

## Project Overview
An autonomous AI stock trading agent that makes its own trading decisions on a cron schedule (unified trading loop → reflection). Uses Alpaca paper trading, has persistent structured memory in Supabase, and a Next.js web UI for monitoring/chat.

**Goal**: Beat the S&P 500 consistently with disciplined risk management. Not chasing home runs — systematic alpha through quality growth investing focused on AI infrastructure.

## Your Role

You are not just writing code. You are a **thinking partner** in building a better autonomous investor. This means:

- **Actively identify gaps** in Monet's decision-making, risk management, and data quality
- **Suggest better practices** — if Monet's behavior is suboptimal (too conservative, too aggressive, missing signals), propose fixes to skills, tools, or strategy memory
- **Recommend tools/APIs** — if a paid data source, screening tool, or analytics API would meaningfully improve Monet's edge, flag it with cost/benefit reasoning
- **Challenge assumptions** — if the cron schedule, position sizing, confidence formula, or any rule seems wrong, say so
- **Think like a portfolio manager** — understand the difference between entry optimization and opportunity cost, when to be disciplined vs when discipline becomes an excuse for inaction

When reviewing Monet's journal entries, trades, or decisions, look for:
- Systematic biases (always too bullish? always waiting?)
- Tools that return bad/stale data
- Skills that produce verbose reasoning but weak decisions
- Missing capabilities that would give Monet an edge

## Architecture

```
stock_agent/
├── agent/                          # Python backend (LangGraph + Deep Agents)
│   ├── langgraph.json              # Graph registry — 2 graphs in 1 deployment
│   ├── src/stock_agent/
│   │   ├── agent.py                # Chat graph (read-only, exposed to users)
│   │   ├── autonomy.py             # Autonomous graph (full trading tools)
│   │   ├── tools.py                # AUTONOMOUS_TOOLS + CHAT_TOOLS definitions
│   │   ├── db.py                   # Supabase CRUD (memory, journal, trades, watchlist, risk)
│   │   ├── supabase_client.py      # Supabase singleton client
│   │   ├── memory.py               # load_agent_context() — structured memory for system prompt
│   │   ├── auth.py                 # Supabase JWT validation via langgraph_sdk.Auth
│   │   ├── middleware.py           # handle_tool_errors + ToolRetryMiddleware
│   │   ├── alpaca_client.py        # Alpaca paper trading client
│   │   ├── market_data.py          # Historical bars, quotes, portfolio from Alpaca
│   │   ├── technical.py            # RSI, MACD, Bollinger, SMA, ATR indicators
│   │   └── risk.py                 # Pre-trade risk checks
│   ├── skills/                     # Deep Agent skill definitions
│   │   ├── trading-loop/SKILL.md   # Unified loop: research → analyze → decide (Steps 0-8)
│   │   ├── reflection/SKILL.md     # Standalone EOD reflection + daily recap
│   │   ├── weekly-review/SKILL.md  # Sunday full review + stage management
│   │   ├── database-guide/SKILL.md # Schema reference for query_database
│   │   ├── research/SKILL.md       # (legacy — replaced by trading-loop)
│   │   ├── analysis/SKILL.md       # (legacy — replaced by trading-loop)
│   │   ├── trade-execution/SKILL.md # (legacy — replaced by trading-loop)
│   │   └── weekend-research/SKILL.md # (legacy — replaced by trading-loop weekend mode)
│   └── scripts/
│       ├── seed_strategy.py        # One-time seed for founding strategy
│       ├── seed_stage.py           # Seed agent_stage to "explore"
│       ├── create_crons.py         # Create/update LangGraph cron jobs
│       └── migrate_memory.py       # One-time migration to structured memory
├── web/                            # Next.js frontend
│   └── app/
│       ├── (app)/dashboard/        # Portfolio, trades, watchlist
│       ├── (app)/chat/             # Chat with agent (LangGraph streaming)
│       ├── (app)/journal/          # Agent's reflections feed
│       ├── (app)/activity/         # Merged feed of trades + journal
│       └── (auth)/login|signup/    # Supabase auth pages
└── supabase/                       # Database migrations
```

## Two Graphs, One Deployment

Both graphs are registered in `langgraph.json` and run in a single LangGraph Platform deployment:

| Graph | File | Purpose | Tools |
|-------|------|---------|-------|
| `monet_agent` | `agent.py:graph` | Chat mode — users ask questions | Read-only: search, quotes, portfolio, outlook, journal, trades |
| `autonomous_loop` | `autonomy.py:autonomous_graph` | Trading loop — runs on cron | Full: above + place_order, write_memory, write_journal, watchlist, risk check, technicals, fundamentals, screening, structured memory tools |

## Scheduling (17 runs/week)

The autonomous loop runs via **LangGraph Platform crons**:

### Weekdays (Mon-Fri) — 3 runs/day
| Cron (UTC) | Toronto | Skill | Focus |
|------------|---------|-------|-------|
| `0 14 * * 1-5` | 10am | Trading Loop | Full pass: research → analyze → decide |
| `0 17 * * 1-5` | 1pm | Trading Loop | Full pass (builds on morning's work) |
| `0 20 * * 1-5` | 4pm | Reflection | EOD review, calibration, daily recap |

### Weekends — 1 run/day
| Cron (UTC) | Toronto | Skill | Focus |
|------------|---------|-------|-------|
| `0 15 * * 6` | Sat 11am | Trading Loop (weekend mode) | 3-5 deep dives, no execution |
| `0 15 * * 0` | Sun 11am | Weekly Review | Performance, strategy, stage management |

### Explore/Exploit Lifecycle
Agent tracks maturity via `agent_stage` memory (`explore` → `balanced` → `exploit`):
- **Explore**: Screen aggressively, 2+ deep dives/run, build watchlist to 15+, trade at 0.8+ confidence
- **Balanced**: Maintain research cadence, check price targets actively, trade at 0.6+ confidence
- **Exploit**: Focus on position management, research only for new catalysts or replacements

Managed via `agent/scripts/create_crons.py`. **Note**: UTC-based, needs manual adjustment for DST changes (EDT/EST)

## Structured Memory Layer

Memory uses typed schemas stored in `agent_memory` with key prefixes:

| Key Pattern | Tool | Schema |
|-------------|------|--------|
| `market_regime` | `update_market_regime()` | `{vix, breadth_pct, rotation_signal, regime_label, confidence, as_of}` |
| `stock:{SYMBOL}` | `update_stock_analysis()` | `{symbol, thesis, target_entry, target_exit, confidence, bull_case, bear_case, fundamentals_score, status, target_set_date, regime_when_set, last_analyzed}` |
| `decision:{SYMBOL}:{YYYY-MM-DD}` | `record_decision()` | `{symbol, action, reasoning, confidence, price_at_decision, executed, decided_at}` |
| `earnings_reaction:{SYMBOL}` | `write_agent_memory()` | `{quarter, actual_eps, estimated_eps, surprise_pct, guidance, estimate_revision, thesis_impact, action_taken, date}` |
| `strategy`, `agent_stage`, `risk_appetite` | `write_agent_memory()` | Freeform (unchanged) |

`load_agent_context()` reads structured keys categorically and falls back to legacy format gracefully.

## Conviction-Based Order Logic

Order aggressiveness matches conviction level (Step 7 of trading-loop skill):

| Confidence | Order Type | Rationale |
|-----------|------------|-----------|
| 0.85+ | Market order or limit within 0.5% | Get the fill. Missing the trade > paying 2% more. |
| 0.70-0.85 | Limit 1-2% below current | Want a small pullback. Okay to miss. |
| 0.60-0.70 | Limit at target_entry | Only buy if it comes to you. |

**Key principle**: Sector rotation is a soft signal, not a hard gate. Don't block high-conviction trades solely because of rotation.

## Deployment

- **LangGraph Platform**: `https://monet-0f211e9ce05255c2a85f92d6847873b5.us.langgraph.app`
- **Tracing**: LangSmith project `monet`
- **Web frontend**: Vercel (Next.js)

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `agent_memory` | Structured key-value beliefs (market_regime, stock:*, decision:*, strategy, etc.) |
| `agent_journal` | Timestamped entries (research, analysis, trade, reflection, user_insight) |
| `trades` | Trade log with thesis, confidence, broker_order_id, status |
| `watchlist` | Symbols with thesis, target_entry, target_exit (auto-synced by update_stock_analysis) |
| `risk_settings` | Single row: max_position_pct, max_daily_loss, max_total_exposure_pct, default_stop_loss_pct |
| `profiles` | Web UI viewer profiles |

## Key Patterns

- Agent uses `deepagents` + `create_deep_agent` for graph definition
- `FilesystemBackend(virtual_mode=True)` for skill file access
- Auth: Supabase JWT validated via `langgraph_sdk.Auth`, dev mode allows unauthenticated
- Middleware: `handle_tool_errors` (catch-all safety net) + `ToolRetryMiddleware` (retries for search/quote/historical)
- Frontend: `@assistant-ui/react` + `@langchain/langgraph-sdk` for streaming chat
- Memory: `load_agent_context()` reads structured memory (market_regime, stock:*, decision:*) and formats categorically
- Risk: `check_risk()` is called inside `place_order` — trades that fail risk checks are rejected
- Chat tool priority: journal/memory first → live market data → internet search last

## Commands

```bash
# Agent (local dev)
cd agent && langgraph dev          # Run agent locally
cd agent && pip install -e ".[dev]" # Install with dev deps

# Web
cd web && npm install && npm run dev # Run frontend

# Supabase
supabase start                      # Local Supabase
supabase db reset                   # Apply migrations

# Seed founding strategy
cd agent && python scripts/seed_strategy.py

# Seed explore/exploit stage
cd agent && python scripts/seed_stage.py

# Update cron jobs
cd agent && python scripts/create_crons.py

# Migrate legacy memory to structured format
cd agent && python scripts/migrate_memory.py
```

## Release Log

When you ship a meaningful change (new tool, UI restructure, new skill, behavior change), update the release log at `web/components/trading/release-log.tsx`:
- Add a new entry at the top of the `RELEASES` array
- Bump the version (v0.1, v0.2, etc.)
- Use today's date and a short title
- List 3-5 bullet points summarizing what changed

## Important Rules

- Chat mode tools are READ-ONLY — never expose `place_order` in chat
- Chat mode checks internal data (journal, memory) BEFORE reaching for internet search
- Autonomous mode writes structured memory after every loop
- All trades must pass risk checks before execution (5% stop loss, 80% max exposure, $500 daily loss limit)
- The agent has ONE persistent identity, not per-user sessions
- Max 5-8 positions, 10% max per position, 20% cash buffer
- After each cycle: compare outcomes to thesis, calibrate confidence, update beliefs
- Sector rotation is a soft signal — don't block high-conviction trades solely because of it

## Environment Variables

Required in `agent/.env`:
- `ANTHROPIC_API_KEY` — LLM
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Database
- `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPACA_BASE_URL` — Paper trading
- `TAVILY_API_KEY` — Web search
- `LANGSMITH_API_KEY`, `LANGSMITH_TRACING`, `LANGSMITH_PROJECT` — Observability
- `MODEL_NAME` — Model ID (default: `anthropic:claude-sonnet-4-5-20250929`)
