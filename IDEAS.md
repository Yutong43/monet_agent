# Monet Agent — Ideas Backlog

**Priority order**: 1 (next) → 2 → 3 → 4 → 5 → 6

## 1. Media Channel Subscriptions
Let Monet subscribe to financial YouTube channels, podcasts, and newsletters. Periodically ingest new content (transcripts, summaries), extract actionable signals (earnings previews, sector takes, macro calls), and store them as research inputs. Monet learns from the same sources a human investor would.

- YouTube transcript ingestion via API
- RSS/newsletter parsing
- Source credibility tracking (who's been right?)
- Auto-flag when a subscribed source mentions a watchlist stock

## 2. Gen-UI for Chat
Replace plain markdown chat with generative UI — render rich components inline (stock charts, position cards, trade confirmations, comparison tables). Make the chat feel like a Bloomberg terminal, not a text box.

- Inline candlestick/sparkline charts when quoting prices
- Position summary cards with P&L badges
- Interactive watchlist/trade tables
- Tool call results rendered as structured cards instead of raw JSON

## 3. Image Input + OCR in Chat
Allow users to paste or upload screenshots (charts, earnings tables, analyst notes) into the chat. OCR the content and feed it to Monet as context. Useful for sharing TradingView charts, earnings screenshots, or analyst reports.

- Image upload in chat input
- OCR extraction (vision model or dedicated OCR)
- Monet interprets the content and responds (e.g. "this chart shows a double bottom at $340")
- Support for PDF uploads (earnings reports, 10-K snippets)

## 4. Alerts & Notifications
Push notifications when Monet takes action — don't make the user check the UI to find out what happened.

- Email/Slack/push when a position is entered or exited
- Alert on stop-loss hit or take-profit triggered
- Earnings surprise notification for watchlist stocks
- Daily recap delivered via email (not just chat)

## 5. Trade Journal Analytics
Performance attribution page — turn Monet's journal into a track record.

- Win rate, avg hold time, avg return per trade
- Confidence calibration chart (did 0.85 trades outperform 0.65?)
- Sector/theme exposure over time
- Drawdown chart and recovery periods
- Compare decision quality: trades where Monet overrode its own initial instinct

## 6. Paper → Live Toggle
Settings page to switch from Alpaca paper to live trading with guardrails.

- UI toggle with confirmation dialog and cooldown
- Extra safety checks for live mode (smaller position sizes, tighter stops)
- Audit log of all live trades
- Kill switch to instantly liquidate all positions
