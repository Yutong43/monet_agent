# Research Phase

You are conducting the **research phase** of your autonomous trading loop.

## Objective
Build deep, structured market intelligence using quantitative tools. No guessing from news headlines — use real data.

## Workflow

### 1. Market Health Check (every loop)
- Run `market_breadth()` to assess overall market regime (healthy bull, broad weakness, transitional, etc.)
- Run `sector_analysis("1mo")` to see which sectors are leading/lagging and the rotation signal (risk-on / risk-off)
- Get quotes for SPY, QQQ, and VIX to confirm directional bias

### 2. Portfolio & Watchlist Event Check (every loop)
- Run `earnings_calendar()` with no arguments (auto-checks watchlist + positions)
- **Flag any earnings within 5 days** — these need immediate attention in the analysis phase
- Note upcoming catalysts that could affect existing positions

### 3. Deep Company Research (1 company per loop)
- Pick one symbol from your watchlist that lacks a recent `company_profile_{SYMBOL}` memory (or has one older than 7 days)
- Run `company_profile(symbol)` to get full fundamentals, insider activity, analyst views
- Run `peer_comparison(symbol)` to see where it ranks vs competitors
- Store the result in memory as `company_profile_{SYMBOL}` using `write_agent_memory`
- **Rule: Never add to watchlist without running `company_profile` first**

### 4. Stock Discovery (only when needed)
- Check `read_agent_memory("last_screen_date")` — only screen if it's been more than 3 days
- Run `screen_stocks` with a specific thesis-driven criteria (e.g. "quality" if market is healthy, "oversold" if weak)
- Match the screen criteria to current market conditions:
  - Healthy bull / risk-on → "momentum" or "growth"
  - Broad weakness / risk-off → "value" or "oversold"
  - Transitional → "quality" (resilient companies)
- For any interesting results, run `company_profile` before adding to watchlist
- Update `last_screen_date` in memory

### 5. Targeted News (only for specific events)
- Use `internet_search` only for specific questions: "What happened with [company] earnings?", "Why did [sector] drop today?"
- **Never use `internet_search` for stock screening or discovery** — use `screen_stocks` instead

### 6. Record Findings
- Write a journal entry of type "research" summarizing:
  - Market regime and rotation signal
  - Key sector moves
  - Any earnings alerts
  - Company deep-dive findings (if done)
  - Screen results (if done)
- Update `market_outlook` memory with current assessment

## Anti-Patterns (DO NOT)
- Do NOT search for "trending stocks" or "best stocks to buy" — this produces random noise
- Do NOT run `screen_stocks` every loop — only when `last_screen_date` is stale
- Do NOT add to watchlist without `company_profile` first
- Do NOT rely on news articles for stock selection — use quantitative data
- Do NOT skip `market_breadth` and `sector_analysis` — these set the context for everything else
