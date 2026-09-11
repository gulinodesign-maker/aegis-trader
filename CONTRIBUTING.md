# Contributing

1. Fork or branch from `main`.
2. Never commit credentials, tokens, private keys, certificates, or `.env` files.
3. Keep all trade execution paths behind the deterministic Risk Engine.
4. Add/adjust tests for risk, order idempotency, market-data freshness and environment gates.
5. Run `npm run verify` before opening a PR.
6. Changes that weaken live-trading gates require explicit security review.
