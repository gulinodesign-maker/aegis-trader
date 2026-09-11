import test from "node:test";
import assert from "node:assert/strict";
import { calculatePositionSize, calculateRiskReward } from "../src/risk/position-sizing";
import { evaluateTradeRisk } from "../src/risk/risk-engine";
import { calculateLongStop } from "../src/signal/signal-engine";
import type { RiskConfig, RiskContext, TradeProposal } from "../src/domain/types";

const config: RiskConfig = {
  maxRiskPerTradePercent: 0.5,
  maxDailyLossPercent: 2,
  maxTotalExposurePercent: 100,
  maxSinglePositionPercent: 35,
  maxOpenPositions: 3,
  minCashReservePercent: 10,
  maxSpreadBps: 35,
  maxQuoteAgeSeconds: 15,
  maxAtrPercent: 6, minAverageDollarVolume: 0,
  lossStreakCooldownCount: 3,
  lossStreakCooldownMinutes: 60,
  killSwitch: false
};

const now = new Date("2026-09-11T15:00:00.000Z");
const proposal: TradeProposal = {
  id: "p-1", symbol: "AAPL", action: "BUY", confidence: 80,
  entry: 100, stopLoss: 98, takeProfit: 104, riskReward: 2,
  positionSize: 0, thesis: "test", invalidation: "below stop", signalIds: ["s1"], createdAt: now.toISOString()
};
const context: RiskContext = {
  now,
  account: { id: "a1", currency: "EUR", equity: 20, cash: 20, buyingPower: 20, todayPnl: 0, totalPnl: 0, mode: "paper" },
  positions: [],
  quote: { symbol: "AAPL", bid: 99.9, ask: 100, last: 99.95, currency: "USD", origin: "DEMO", timestamp: now.toISOString() },
  marketClock: { isOpen: true, timestamp: now.toISOString() },
  dailyRealizedPnl: 0,
  consecutiveLosses: 0,
  totalExposure: 0,
  fxRateToAccountCurrency: 1
};

test("position sizing obeys risk and fractional shares", () => {
  const result = calculatePositionSize({
    accountEquity: 20, cash: 20, entry: 100, stop: 98, riskPercent: 0.5,
    minCashReservePercent: 10, maxSinglePositionPercent: 100, fxRateToAccountCurrency: 1, supportsFractional: true
  });
  assert.equal(result.riskCapital, 0.1);
  assert.equal(result.quantity, 0.05);
  assert.equal(result.maxLoss, 0.1);
});

test("position sizing preserves minimum cash reserve and single-position cap", () => {
  const result = calculatePositionSize({
    accountEquity: 20, cash: 20, entry: 100, stop: 99.99, riskPercent: 0.5,
    minCashReservePercent: 10, maxSinglePositionPercent: 35, fxRateToAccountCurrency: 1, supportsFractional: true
  });
  assert.ok(result.notionalAccountCurrency <= 7.000001);
  assert.ok(result.limitedBy.includes("SINGLE_POSITION"));
});

test("risk/reward uses stop distance", () => {
  assert.equal(calculateRiskReward(100, 98, 104), 2);
});

test("valid conservative trade passes deterministic risk gate", () => {
  const decision = evaluateTradeRisk(proposal, context, config, { supportsFractional: true, observedAtrPercent: 2 });
  assert.equal(decision.approved, true);
  assert.ok(decision.quantity > 0);
  assert.ok(decision.maxLoss <= 0.100001);
});

test("kill switch blocks every new trade", () => {
  const decision = evaluateTradeRisk(proposal, context, { ...config, killSwitch: true }, { supportsFractional: true });
  assert.equal(decision.approved, false);
  assert.ok(decision.reasons.includes("KILL_SWITCH_ACTIVE"));
  assert.equal(decision.quantity, 0);
});

test("max daily loss blocks new trades", () => {
  const lossContext = { ...context, dailyRealizedPnl: -0.4 };
  const decision = evaluateTradeRisk(proposal, lossContext, config, { supportsFractional: true });
  assert.equal(decision.approved, false);
  assert.ok(decision.reasons.includes("MAX_DAILY_LOSS"));
});

test("missing stop is rejected", () => {
  const decision = evaluateTradeRisk({ ...proposal, stopLoss: 0 }, context, config, { supportsFractional: true });
  assert.equal(decision.approved, false);
  assert.ok(decision.reasons.includes("STOP_LOSS_REQUIRED"));
});

test("stale quote, wide spread and excessive volatility are rejected", () => {
  const stale = new Date(now.getTime() - 60_000).toISOString();
  const badContext = { ...context, quote: { ...context.quote, timestamp: stale, bid: 98, ask: 100 } };
  const decision = evaluateTradeRisk(proposal, badContext, config, { supportsFractional: true, observedAtrPercent: 8 });
  assert.equal(decision.approved, false);
  assert.ok(decision.reasons.includes("STALE_QUOTE"));
  assert.ok(decision.reasons.includes("SPREAD_TOO_WIDE"));
  assert.ok(decision.reasons.includes("VOLATILITY_TOO_HIGH"));
});


test("long stop uses the tighter valid ATR/support level and remains below entry", () => {
  assert.equal(calculateLongStop(100, 2, 96), 97);
  assert.equal(calculateLongStop(100, 2, 98), 98);
  assert.equal(calculateLongStop(100, 2, 101), 99.99);
});
