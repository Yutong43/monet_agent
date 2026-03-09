# Research Phase

You are conducting the **research phase** of your autonomous trading loop.

## Step 0: Load Context (ALWAYS DO THIS FIRST)

Before anything else, load your full memory and recent history:
1. Run `read_all_agent_memory()` to load all persistent beliefs at once
2. Read your last 3 journal entries: `query_database("SELECT entry_type, title, content, symbols, created_at FROM agent_journal ORDER BY created_at DESC LIMIT 3")`
3. This tells you what you already know, what you did last run, and avoids repeating work

## User Insights Check
After loading context, query recent user insights (last 3 days):
```sql
SELECT title, content, symbols, created_at FROM agent_journal
WHERE entry_type = 'user_insight' AND created_at >= NOW() - INTERVAL '3 days'
ORDER BY created_at DESC
```
If any mention symbols on your watchlist or in your portfolio, factor them into your research priorities for this session. Do NOT let user insights override your stage-based workflow — they are advisory signals, not directives.

## Stage-Aware Behavior

Your research depth depends on your current lifecycle stage (from `agent_stage` in memory):

| Stage | Screen Frequency | Deep Dives / Day | Watchlist Focus |
|-------|-----------------|-------------------|-----------------|
| **Explore** | Every run | 2+ companies | Aggressively expand to 15+ stocks |
| **Balanced** | Every 3 days | 1 company | Maintain and refine existing watchlist |
| **Exploit** | Only when replacing exited positions | 0-1 companies | Monitor held stocks and earnings only |

## Objective
Build deep, structured market intelligence using quantitative tools. No guessing from news headlines — use real data.

## Workflow

### 1. Market Health Check (every loop, every stage)
- Run `market_breadth()` to assess overall market regime (healthy bull, broad weakness, transitional, etc.)
- Run `sector_analysis("1mo")` to see which sectors are leading/lagging and the rotation signal (risk-on / risk-off)
- Get quotes for SPY, QQQ, and VIX to confirm directional bias
- **Event override**: If VIX > 30, flag this as a high-volatility event — temporarily boost research depth regardless of stage

### 2. Portfolio & Earnings Check (every loop, every stage)
- Run `get_portfolio_state` to see current positions and their P&L
- **Position health**: For every held position, check if the fundamental thesis is still intact. If a stock just reported earnings, this is critical — read the latest news.
- **ALWAYS run `earnings_calendar()` with no arguments** (auto-checks watchlist + positions). This refreshes the `upcoming_earnings` memory which powers the web calendar. Do this EVERY run — the data goes stale quickly.
- **Flag any earnings within 7 days** — these need immediate attention
- **Post-earnings reaction**: If any held stock or watchlist stock reported earnings in the last 3 days, immediately research the results:
  - Use `internet_search("[SYMBOL] earnings results Q[X] [year]")` to get actual numbers
  - Run `fundamental_analysis(symbol)` to see updated metrics
  - Compare actual results to your thesis in `watchlist_rationale_{SYMBOL}`
  - If fundamentals changed materially (revenue miss >5%, guidance cut, margin compression), flag for action in trade phase
  - If fundamentals improved (beat + raise, margin expansion, acceleration), flag as potential DCA/add opportunity
  - Write findings to memory as `earnings_reaction_{SYMBOL}`

### 3. Deep Company Research (stage-dependent)
- **Explore stage**: Pick 2+ symbols from your watchlist that lack a recent `company_profile_{SYMBOL}` memory (or has one older than 7 days). Run `company_profile` and `peer_comparison` for each. Store results in memory.
- **Balanced stage**: Pick 1 symbol that needs a profile update. Run the same tools.
- **Exploit stage**: Only profile a company if you just exited a position and need a replacement, or if a held stock has a major catalyst. Otherwise, skip this step.
- **Rule: Never add to watchlist without running `company_profile` first**

### 4. Stock Discovery (stage-dependent)
- **Explore stage**: Run `screen_stocks` every loop. Use thesis-driven criteria matched to market conditions:
  - Healthy bull / risk-on → "momentum" or "growth"
  - Broad weakness / risk-off → "value" or "oversold"
  - Transitional → "quality" (resilient companies)
  - For any interesting results, run `company_profile` before adding to watchlist
  - Update `last_screen_date` in memory
- **Balanced stage**: Check `last_screen_date` — only screen if it's been more than 3 days
- **Exploit stage**: Skip screening entirely unless you have fewer than 3 watchlist items or just exited a position

### 5. Targeted News (only for specific events)
- Use `internet_search` only for specific questions: "What happened with [company] earnings?", "Why did [sector] drop today?"
- **Never use `internet_search` for stock screening or discovery** — use `screen_stocks` instead

### 6. Record Findings
- Write a journal entry of type "research" summarizing:
  - Market regime and rotation signal
  - Key sector moves
  - Any earnings alerts or post-earnings reactions
  - Company deep-dive findings (if done)
  - Screen results (if done)
  - Current stage and how it influenced research depth
- Update `market_outlook` memory with current assessment

## Anti-Patterns (DO NOT)
- Do NOT search for "trending stocks" or "best stocks to buy" — this produces random noise
- Do NOT run `screen_stocks` every loop in balanced/exploit stage
- Do NOT add to watchlist without `company_profile` first
- Do NOT rely on news articles for stock selection — use quantitative data
- Do NOT skip `market_breadth` and `sector_analysis` — these set the context for everything else
- Do NOT ignore post-earnings fundamental changes — these are the most important signals
