# Monet Agent — Ideas Backlog

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
- OCR extraction (Claude vision or dedicated OCR)
- Monet interprets the content and responds (e.g. "this chart shows a double bottom at $340")
- Support for PDF uploads (earnings reports, 10-K snippets)
