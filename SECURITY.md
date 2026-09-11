# Security Policy

Do not report secrets in public issues. If you discover a vulnerability, disclose it privately to the repository owner.

## Non-negotiable controls

- Broker and AI secrets are server-only environment variables.
- The LLM cannot call a broker adapter directly.
- Every executable trade proposal must pass the deterministic Risk Engine.
- Live trading is disabled unless `TRADING_MODE=live`, `ENABLE_LIVE_TRADING=true`, and `LIVE_TRADING_ACKNOWLEDGED=true` are all present with valid broker credentials.
- Every order uses an idempotency key and duplicate-order guard.
- Revolut personal login/credentials are never automated or stored.
