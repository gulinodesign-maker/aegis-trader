BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE trading_mode AS ENUM ('paper', 'live');
CREATE TYPE order_side AS ENUM ('BUY', 'SELL');
CREATE TYPE order_status AS ENUM ('NEW', 'ACCEPTED', 'FILLED', 'PARTIALLY_FILLED', 'CANCELED', 'REJECTED');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_auth_id text UNIQUE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode trading_mode NOT NULL,
  currency text NOT NULL,
  initial_capital numeric(20,8) NOT NULL,
  equity numeric(20,8) NOT NULL,
  cash numeric(20,8) NOT NULL,
  kill_switch boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mode)
);

CREATE TABLE funding_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text,
  direction text NOT NULL CHECK (direction IN ('DEPOSIT','WITHDRAWAL')),
  amount numeric(20,8) NOT NULL,
  currency text NOT NULL,
  state text NOT NULL,
  reference text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE broker_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_account_id text NOT NULL,
  mode trading_mode NOT NULL,
  encrypted_credentials text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, external_account_id, mode)
);

CREATE TABLE strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  version text NOT NULL,
  config jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid REFERENCES strategies(id),
  symbol text NOT NULL,
  direction text NOT NULL CHECK (direction = 'LONG'),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  entry numeric(20,8) NOT NULL,
  stop numeric(20,8) NOT NULL,
  target numeric(20,8) NOT NULL,
  risk_reward numeric(20,8) NOT NULL,
  reasons jsonb NOT NULL,
  invalidations jsonb NOT NULL,
  metrics jsonb NOT NULL,
  market_data jsonb NOT NULL,
  data_origin text NOT NULL,
  data_timestamp timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signals_symbol_created_idx ON signals(symbol, created_at DESC);

CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  mode trading_mode NOT NULL,
  model text NOT NULL,
  prompt_hash text NOT NULL,
  tool_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_code text
);

CREATE TABLE trade_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  agent_run_id uuid REFERENCES agent_runs(id),
  symbol text NOT NULL,
  action text NOT NULL CHECK (action IN ('BUY','WAIT','CLOSE')),
  confidence numeric(6,3) NOT NULL,
  entry numeric(20,8) NOT NULL,
  stop_loss numeric(20,8) NOT NULL,
  take_profit numeric(20,8) NOT NULL,
  risk_reward numeric(20,8) NOT NULL,
  position_size numeric(20,8) NOT NULL,
  thesis text NOT NULL,
  invalidation text NOT NULL,
  signal_ids jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES trade_proposals(id),
  approved boolean NOT NULL,
  reasons jsonb NOT NULL,
  config_snapshot jsonb NOT NULL,
  context_snapshot jsonb NOT NULL,
  calculated_quantity numeric(20,8) NOT NULL DEFAULT 0,
  max_loss numeric(20,8) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES trade_proposals(id),
  broker_order_id text,
  client_order_id text NOT NULL,
  idempotency_key text NOT NULL,
  mode trading_mode NOT NULL,
  symbol text NOT NULL,
  side order_side NOT NULL,
  quantity numeric(20,8) NOT NULL,
  order_type text NOT NULL,
  stop_loss numeric(20,8) NOT NULL,
  take_profit numeric(20,8) NOT NULL,
  status order_status NOT NULL,
  request_payload jsonb NOT NULL,
  response_payload jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mode, idempotency_key),
  UNIQUE(mode, client_order_id)
);

CREATE TABLE trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id),
  mode trading_mode NOT NULL,
  symbol text NOT NULL,
  quantity numeric(20,8) NOT NULL,
  entry numeric(20,8) NOT NULL,
  exit numeric(20,8),
  pnl numeric(20,8),
  fees numeric(20,8) NOT NULL DEFAULT 0,
  slippage numeric(20,8) NOT NULL DEFAULT 0,
  market_data jsonb NOT NULL,
  signals_snapshot jsonb NOT NULL,
  agent_reasoning_summary text,
  risk_checks jsonb NOT NULL,
  opened_at timestamptz NOT NULL,
  closed_at timestamptz
);

CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  mode trading_mode NOT NULL,
  symbol text NOT NULL,
  quantity numeric(20,8) NOT NULL,
  average_entry numeric(20,8) NOT NULL,
  stop_loss numeric(20,8) NOT NULL,
  take_profit numeric(20,8) NOT NULL,
  current_price numeric(20,8),
  unrealized_pnl numeric(20,8),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mode, symbol)
);

CREATE TABLE daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  mode trading_mode NOT NULL,
  day date NOT NULL,
  equity_open numeric(20,8) NOT NULL,
  equity_close numeric(20,8) NOT NULL,
  realized_pnl numeric(20,8) NOT NULL,
  unrealized_pnl numeric(20,8) NOT NULL,
  fees numeric(20,8) NOT NULL,
  slippage numeric(20,8) NOT NULL,
  trade_count integer NOT NULL,
  max_drawdown numeric(20,8) NOT NULL,
  metrics jsonb NOT NULL,
  UNIQUE(user_id, mode, day)
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  entity_type text,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE system_controls (
  key text PRIMARY KEY,
  bool_value boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO system_controls (key, bool_value) VALUES ('global_kill_switch', false) ON CONFLICT (key) DO NOTHING;

CREATE UNIQUE INDEX positions_system_mode_symbol_uq ON positions(mode, symbol) WHERE user_id IS NULL;
CREATE UNIQUE INDEX daily_metrics_system_mode_day_uq ON daily_metrics(mode, day) WHERE user_id IS NULL;
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX orders_symbol_mode_idx ON orders(symbol, mode, submitted_at DESC);
CREATE INDEX trades_symbol_mode_idx ON trades(symbol, mode, opened_at DESC);

COMMIT;
