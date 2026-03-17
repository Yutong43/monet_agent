ALTER TABLE trades ADD COLUMN IF NOT EXISTS take_profit_price numeric(14,4);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS stop_loss_price numeric(14,4);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS order_class text DEFAULT 'simple';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS parent_order_id text;
