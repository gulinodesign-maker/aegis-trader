import test from "node:test";
import assert from "node:assert/strict";
import { validateLiveTradingGate } from "../src/config/env-core";

test("missing trading mode always defaults safely to paper", () => {
  const result = validateLiveTradingGate({});
  assert.equal(result.allowed, true);
  assert.equal(result.mode, "paper");
});

test("live mode requires both acknowledgements, real broker and credentials", () => {
  const blocked = validateLiveTradingGate({ tradingMode: "live", brokerProvider: "paper" });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasons.includes("ENABLE_LIVE_TRADING_MUST_BE_TRUE"));
  assert.ok(blocked.reasons.includes("LIVE_TRADING_ACKNOWLEDGED_MUST_BE_TRUE"));
  assert.ok(blocked.reasons.includes("REAL_BROKER_REQUIRED"));
  assert.ok(blocked.reasons.includes("BROKER_API_KEY_REQUIRED"));
  assert.ok(blocked.reasons.includes("BROKER_API_SECRET_REQUIRED"));

  const allowed = validateLiveTradingGate({
    tradingMode: "live", enableLiveTrading: "true", liveTradingAcknowledged: "true",
    brokerProvider: "alpaca", brokerApiKey: "key", brokerApiSecret: "secret"
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.mode, "live");
});
