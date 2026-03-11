-- Add deployed_pct column to equity_snapshots for meaningful alpha tracking.
-- Alpha is only meaningful when >50% of portfolio is deployed in positions.
ALTER TABLE equity_snapshots ADD COLUMN IF NOT EXISTS deployed_pct numeric DEFAULT 0;
