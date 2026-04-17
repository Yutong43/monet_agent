-- Backtest infrastructure: runs, snapshots, trades, factor IC analyses
-- Supports reproducible algorithm variant comparison.

CREATE TABLE backtest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_name text NOT NULL,
  variant_config jsonb NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  starting_equity numeric(14,2) NOT NULL,
  final_equity numeric(14,2),
  total_return_pct numeric(8,4),
  spy_return_pct numeric(8,4),
  alpha_pct numeric(8,4),
  sharpe numeric(8,4),
  max_drawdown_pct numeric(8,4),
  win_rate_pct numeric(8,4),
  trade_count int,
  avg_hold_days numeric(6,2),
  stop_hit_rate_pct numeric(8,4),
  status text DEFAULT 'pending',        -- pending | running | completed | failed
  notes text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_backtest_runs_variant ON backtest_runs(variant_name, created_at DESC);
CREATE INDEX idx_backtest_runs_created ON backtest_runs(created_at DESC);

CREATE TABLE backtest_snapshots (
  run_id uuid REFERENCES backtest_runs(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  equity numeric(14,2),
  cash numeric(14,2),
  positions_value numeric(14,2),
  spy_close numeric(14,4),
  portfolio_return_pct numeric(8,4),
  spy_return_pct numeric(8,4),
  deployed_pct numeric(6,2),
  PRIMARY KEY (run_id, snapshot_date)
);

CREATE INDEX idx_bt_snapshots_run ON backtest_snapshots(run_id, snapshot_date);

CREATE TABLE backtest_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES backtest_runs(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  side text NOT NULL,                   -- buy | sell
  trade_date date NOT NULL,
  price numeric(14,4),
  quantity numeric(14,4),
  composite_score numeric(6,2),
  exit_reason text,                     -- stop_loss | take_profit | signal_rank_drop | end_of_period
  pnl numeric(14,2),
  holding_days int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bt_trades_run ON backtest_trades(run_id, trade_date);
CREATE INDEX idx_bt_trades_symbol ON backtest_trades(symbol, trade_date);

CREATE TABLE factor_ic_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_name text NOT NULL,
  factor_name text NOT NULL,            -- momentum | quality | value | composite
  forward_horizon_days int NOT NULL,    -- 5 | 10 | 20 | 60
  start_date date NOT NULL,
  end_date date NOT NULL,
  ic_mean numeric(8,5),
  ic_std numeric(8,5),
  ic_tstat numeric(8,4),
  sample_size int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_factor_ic_variant ON factor_ic_runs(variant_name, created_at DESC);
CREATE INDEX idx_factor_ic_factor ON factor_ic_runs(factor_name, forward_horizon_days);
