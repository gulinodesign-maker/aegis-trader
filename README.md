# Aegis Trader — safety-first AI trading agent MVP

Aegis Trader is an iPhone-first Next.js PWA for **paper trading and trading research**. It deliberately separates quantitative signals, language-model analysis, deterministic risk controls and broker execution. It does **not** promise returns and it does not assume any included strategy is profitable.

> **Default state:** `DEMO_MODE=true`, `TRADING_MODE=paper`, `EXECUTION_MODE=MANUAL`, virtual capital **€20.00**. No API key is required to see the app.
>
> **Not investment advice.** Paper results do not imply live results. Real execution can differ because of fees, spread, slippage, latency, fills, taxes, market impact and data quality.

## 1. What the project does

The MVP provides:

- iPhone-first Today, Scanner, Agent, Opportunity, Portfolio and Settings screens;
- installable PWA shell, bottom navigation, safe-area support, touch targets and dark UI;
- explicit `DEMO DATA`, `PAPER` and `LIVE` mode badges;
- a provider-neutral market-data layer;
- a quantitative signal engine using EMA, RSI, ATR, VWAP, momentum, breakout, relative volume and simple support/resistance;
- a tool-using AI trading analyst with strict structured output and no broker execution tool;
- a deterministic Risk Engine with mandatory stop loss, fractional position sizing, daily-loss cap, exposure limits, spread/staleness/volatility/market-hours checks, loss-streak cooldown, cash reserve and global Kill Switch;
- an `ExecutionEngine` that always invokes the Risk Engine before `BrokerAdapter.submitOrder()`;
- a local `PaperBrokerAdapter` and an environment-gated Alpaca adapter;
- a backtest framework that reports trades, win rate, average win/loss, expectancy, profit factor, Sharpe only with adequate sample size, max drawdown, capital, commissions and simulated slippage;
- PostgreSQL schema for market/agent/risk/order/trade/performance/audit records;
- abstract funding with manual SEPA as the safe default and an official Revolut Business read/reconciliation adapter behind a feature flag;
- server-side cron routes for scans, position monitoring and daily snapshots;
- CI for lint, typecheck, unit/integration tests and production build.

## 2. Architecture

The non-negotiable execution path is:

```text
MarketDataProvider
      │
      ▼
Quant Signal Engine
      │ structured Signal
      ▼
AI Trading Agent
      │ structured TradeProposal only
      ▼
Deterministic Risk Engine
      │ approve / reject + position size
      ▼
Execution Engine
      │ broker-neutral OrderRequest
      ▼
BrokerAdapter
      │
      ▼
Paper broker / explicitly enabled real broker
```

The LLM cannot submit arbitrary broker calls. Its tool set is read/analysis oriented and `propose_trade` only validates a proposal. `ExecutionEngine.executeBuy()` recomputes risk itself; it does not accept an `approved=true` value from the AI or client.

Funding is independent of trading:

```text
Revolut / bank account
        │ SEPA funding
        ▼
   Broker cash
        │
        ▼
     Trading
        │
        ▼
   Broker cash
        │ manual withdrawal request in V1
        ▼
Revolut / bank account
```

Aegis does not create a proprietary wallet and does not custody user money.

### Main source layout

```text
src/
  agent/       structured agent schema, tools and Responses API loop
  app/         Next.js App Router UI + server routes
  backtest/    deterministic backtesting/analytics
  broker/      BrokerAdapter, paper broker, Alpaca adapter
  config/      validated server environment + live-mode gate
  db/          PostgreSQL connection and audit/risk persistence helpers
  demo/        clearly labelled synthetic demo data
  domain/      shared TypeScript domain types
  execution/   mandatory Risk Engine -> broker boundary
  funding/     FundingProvider, SEPA, Revolut Business adapter
  market/      MarketDataProvider implementations
  profit/      non-automatic profit-sweep eligibility calculation
  risk/        deterministic risk checks and position sizing
  security/    CSRF/origin checks, rate limiting, crypto, idempotency
  signal/      quantitative indicators and signal scoring

db/migrations/001_init.sql
.github/workflows/ci.yml
```

## 3. Local development

Prerequisites:

- Node.js 22+
- npm
- no external service for Demo Mode
- PostgreSQL only when leaving Demo Mode

```bash
git clone <your-repository-url>
cd ai-trading-agent-mvp
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. With the example defaults you immediately get a virtual €20 paper account and three synthetic opportunities. The UI labels them `DEMO DATA`; they must never be interpreted as current market quotes.

Run the verification suite:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Or all at once:

```bash
npm run verify
```

## 4. Environment variables

Copy `.env.example` and change only what you need. Secrets are server-only and must never use a `NEXT_PUBLIC_` prefix.

### Core mode

| Variable | Default | Purpose |
|---|---:|---|
| `DEMO_MODE` | `true` | Synthetic, clearly labelled data and local paper broker |
| `TRADING_MODE` | `paper` | `paper` or `live`; missing value always resolves to paper |
| `EXECUTION_MODE` | `MANUAL` | `MANUAL`, `ASSISTED`, future `AUTO` |
| `INITIAL_CAPITAL_EUR` | `20` | Authorized virtual/start capital |

### Risk defaults

| Variable | Default |
|---|---:|
| `MAX_RISK_PER_TRADE_PERCENT` | `0.5` |
| `MAX_DAILY_LOSS_PERCENT` | `2` |
| `MAX_TOTAL_EXPOSURE_PERCENT` | `100` |
| `MAX_SINGLE_POSITION_PERCENT` | `35` |
| `MAX_OPEN_POSITIONS` | `3` |
| `MIN_CASH_RESERVE_PERCENT` | `10` |
| `MAX_SPREAD_BPS` | `35` |
| `MAX_QUOTE_AGE_SECONDS` | `15` |
| `MAX_ATR_PERCENT` | `6` |
| `LOSS_STREAK_COOLDOWN_COUNT` | `3` |
| `LOSS_STREAK_COOLDOWN_MINUTES` | `60` |
| `KILL_SWITCH` | `false` |

Risk percentage does not automatically increase after profits. Sizing uses current equity but keeps the configured percentage cap.

### Server secrets

- `DATABASE_URL`
- `DATABASE_ENCRYPTION_KEY`
- `OPENAI_API_KEY`
- `ALPACA_API_KEY`
- `ALPACA_API_SECRET`
- `REVOLUT_*`
- `CRON_SECRET`

Do not expose these in client components, browser storage, logs or Git.

## 5. Demo Mode

`DEMO_MODE=true` is intentionally zero-config:

- virtual capital: €20;
- mode: PAPER;
- three deterministic/synthetic opportunities;
- synthetic candles and quote origin `DEMO`;
- local in-memory paper portfolio;
- deterministic demo-agent response when no OpenAI key exists.

The in-memory demo paper state is for UI/testing only and can reset on server restart/serverless cold start. Durable paper trading should use an external paper broker and PostgreSQL event records.

## 6. Paper trading

Two paper paths exist:

1. `PaperBrokerAdapter`: fully local, fractional, long-only simulation for tests/demo.
2. Alpaca paper environment: enabled only outside Demo Mode with official credentials and `TRADING_MODE=paper`.

Paper trading is a simulation. It does not faithfully reproduce all live-market effects. Backtests additionally model configurable commissions and slippage, but they are still simulations.

## 7. Broker layer

`BrokerAdapter` defines:

- `getAccount()`
- `getCash()`
- `getPositions()`
- `getOrders()`
- `getQuote(symbol)`
- `getCandles(symbol, timeframe)`
- `submitOrder()`
- `cancelOrder()`
- `closePosition()`
- `getOrderStatus()`
- `getMarketClock()`

The first real adapter is Alpaca because its official trading API exposes paper trading, fractional US-equity orders and bracket orders. Broker/account availability and legal eligibility remain jurisdiction/account dependent; verify the broker's current onboarding terms before live use.

V1 application policy remains stricter than broker capabilities: **long-only, cash-constrained, no leverage, no margin use, no options, no CFDs and no short selling**.

Broker-side duplicate correlation uses Alpaca's official `client_order_id`. The application separately maintains an internal deterministic idempotency key and the database enforces uniqueness on `(mode, idempotency_key)` and `(mode, client_order_id)`.

## 8. Revolut and funding

`FundingProvider` is deliberately separate from `BrokerAdapter` and contains:

- `getBalance()`
- `createDeposit()`
- `requestWithdrawal()`
- `getTransactions()`
- `reconcileTransfer()`

The default provider is `SepaFundingProvider`: it returns manual transfer instructions and never automates a personal banking login.

`RevolutFundingProvider` is behind `REVOLUT_BUSINESS_API_ENABLED=true` and is designed only around Revolut's official **Business API**. V1 uses the official legacy Business OAuth flow: an RS256 client-assertion JWT is generated server-side from the configured Business certificate key, the refresh token is exchanged at the documented `/auth/token` endpoint, and the short-lived access token is kept in memory. Account/transaction reads are used for balance/reconciliation; deposit and withdrawal creation remain manual SEPA instructions. The newer unified API-key flow is still documented by Revolut as preview, so it is not assumed here. The project does not use private Revolut endpoints, reverse engineer the mobile app, automate personal login, or store personal banking credentials.

If your account is a personal Revolut account, keep `FUNDING_PROVIDER=sepa` unless Revolut officially makes an appropriate API available for that account type.

## 9. Database

PostgreSQL migration: `db/migrations/001_init.sql`.

It creates the requested tables:

`users`, `accounts`, `funding_transactions`, `broker_accounts`, `strategies`, `signals`, `trade_proposals`, `orders`, `trades`, `positions`, `daily_metrics`, `agent_runs`, `risk_events`, `audit_logs`.

Apply against a standard PostgreSQL/Supabase Postgres database using your preferred migration runner, for example:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_init.sql
```

The schema keeps paper/live mode on performance-bearing records so the two data sets can be queried separately and never silently blended.

## 10. AI agent

The server agent uses OpenAI's Responses API with function tools and a strict JSON Schema output that is validated again with Zod.

Supported tools:

`get_market_status`, `scan_market`, `get_quote`, `get_candles`, `get_asset_metrics`, `get_signal`, `get_portfolio`, `get_open_positions`, `calculate_position_size`, `calculate_trade_risk`, `backtest_signal`, `propose_trade`.

There is intentionally **no `submit_order` tool**. The model can produce only a structured `BUY`, `WAIT` or `CLOSE` proposal. A BUY is not executable until deterministic risk validation succeeds.

## 11. Signal Engine and backtesting

The Signal Engine is deterministic code, not an LLM. V1 scores long opportunities from 0–100 using transparent inputs such as trend (EMA20/EMA50), momentum, breakout, relative volume, RSI and VWAP, with a volatility penalty. ATR and support are used in stop construction; target defaults to a fixed risk multiple in V1.

The included backtester reports:

- trade count;
- win rate;
- average win/loss;
- expectancy;
- profit factor;
- Sharpe only with at least 20 observations and non-zero dispersion;
- max drawdown;
- initial/final capital;
- commission total;
- simulated slippage.

It is intentionally simple and should be treated as a validation harness, not evidence of a deployable edge.

## 12. Scheduler/jobs

The app exposes protected server routes for:

- `/api/jobs/scan`
- `/api/jobs/monitor`
- `/api/jobs/daily`

They require `Authorization: Bearer $CRON_SECRET`. `vercel.json` wires schedules so monitoring does not depend on an iPhone tab remaining open. The V1 monitor observes stop/target state and logs alerts; with default `EXECUTION_MODE=MANUAL` it does not silently auto-close or open positions.

## 13. Security model

Implemented controls include:

- Zod validation of server environment and request payloads;
- double opt-in live gate: `ENABLE_LIVE_TRADING=true` **and** `LIVE_TRADING_ACKNOWLEDGED=true` plus non-paper broker credentials;
- same-origin + custom-header protection for state-changing browser requests;
- server-side rate limiting (replace with shared Redis/KV for multi-instance production);
- deterministic order idempotency plus unique database constraints;
- separate client order IDs;
- AES-256-GCM helper for sensitive persisted values;
- structured logging with recursive redaction of secret-like keys;
- audit/risk event persistence hooks;
- no frontend exposure of broker/OpenAI/Revolut/database-admin secrets;
- no arbitrary LLM-to-broker tool;
- mandatory stop-loss gate;
- global kill switch checked by deterministic code;
- generic API errors rather than secret-bearing response dumps.

Before multi-user production, add a real authentication/authorization provider and a shared distributed rate limiter. The current MVP is intentionally single-user/demo oriented rather than pretending those pieces are complete.

## 14. Tests

The repository includes deterministic tests for the requested safety-critical logic:

- fractional position sizing;
- cash reserve/single-position cap;
- risk checks;
- max daily loss;
- Kill Switch;
- stop calculation/mandatory stop;
- risk/reward;
- duplicate orders/idempotency;
- environment/live-mode validation;
- `PaperBrokerAdapter` integration;
- backtest costs, expectancy and drawdown reporting.

Run:

```bash
npm test
```

## 15. GitHub Actions

`.github/workflows/ci.yml` runs on pushes and pull requests:

```text
checkout → Node 22 → install → lint → typecheck → unit/integration tests → Next.js build
```

Secrets belong in GitHub Actions/Vercel environment settings, never committed files.

## 16. Deployment: local → GitHub → staging → production

### Local

Run in Demo/Paper first and keep `.env.local` untracked.

### GitHub

`main` is the source of truth. CI must be green before promotion. Do not commit `.env*`, certificates, API keys, access tokens or broker/bank credentials.

### Staging / Preview

Connect the repository to Vercel. Git integration can produce preview deployments for non-production branches/PRs. Configure only paper/demo credentials in Preview.

### Production

Configure Production environment variables separately. Prefer a production deployment built from a CI-verified main commit. `TRADING_MODE=paper` remains a valid and recommended production UI state until live readiness has been independently reviewed.

The repository does not require GitHub Pages and must run on a Next.js-compatible server runtime because the API, agent, scheduler and secrets are server-side.

## 17. Paper → live transition

Live mode is intentionally difficult to enable. All of the following are required:

```dotenv
DEMO_MODE=false
TRADING_MODE=live
ENABLE_LIVE_TRADING=true
LIVE_TRADING_ACKNOWLEDGED=true
BROKER_PROVIDER=alpaca
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
DATABASE_URL=...
```

Before enabling it, validate broker eligibility in your jurisdiction, use the smallest practical capital, verify market-data subscriptions, test bracket/fractional behavior in paper, confirm fee/tax implications, validate scheduler/alerts, review audit records, and perform failure-injection tests. The application still applies the same percentage risk caps after profits; it never escalates risk because equity increased.

## 18. Profit sweep

`src/profit/profit-sweep.ts` calculates an **eligible/withdrawable amount only** when enabled and when equity exceeds configured authorized-capital/threshold conditions. V1 does not automatically initiate bank transfers. The user must explicitly request any withdrawal through the funding/broker flow.

## 19. Known MVP limitations

- The included local paper broker is in-memory; use an external paper broker for durable remote paper state.
- Authentication is not yet a multi-user production implementation.
- In-memory rate limiting and idempotency are process-local; database uniqueness is the durable safety backstop and a shared limiter should be added for horizontal scale.
- Alpaca uses USD account values; robust live EUR portfolio accounting requires an official FX source rather than the synthetic demo conversion.
- The scanner universe is intentionally tiny in V1 to control rate limits and validate behavior before expansion.
- Backtest assumptions are simplified and do not prove future profitability.
- Market-data entitlements, broker products, pricing and country eligibility can change; re-check official provider documentation before live use.

## 20. Project status by milestone

- **M1** Repo skeleton, iPhone UI, Demo/Paper, PWA, CI: implemented.
- **M2** Domain model + PostgreSQL schema: implemented.
- **M3** Provider-neutral market data + quantitative signals: implemented.
- **M4** Structured tool-using AI agent: implemented.
- **M5** Deterministic Risk Engine + enforced execution boundary: implemented.
- **M6** Local paper broker + real-adapter boundary: implemented.
- **M7** Backtesting/analytics core: implemented.
- **M8** Funding abstraction + safe SEPA/Revolut Business feature flag: implemented.
- **M9** PWA/iPhone polish: implemented for MVP.
- **M10** GitHub Actions + Vercel-ready configuration: implemented.

The project should remain in paper mode until its assumptions and operational controls have been tested with real market data and realistic costs. No included score, AI confidence value or backtest metric should be interpreted as a return forecast.
