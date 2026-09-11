import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionEngine } from "../src/execution/ExecutionEngine";
import { PaperBrokerAdapter } from "../src/broker/PaperBrokerAdapter";
import type { MarketDataProvider } from "../src/market/MarketDataProvider";
import type { Candle, MarketClock, Quote, RiskConfig, RiskContext, TradeProposal } from "../src/domain/types";

class Market implements MarketDataProvider {
  readonly name = "mock";
  async getQuote(symbol: string): Promise<Quote> { return { symbol, bid: 99.9, ask: 100, last: 99.95, currency: "USD", origin: "DEMO", timestamp: new Date().toISOString() }; }
  async getCandles(): Promise<Candle[]> { return []; }
  async getMarketClock(): Promise<MarketClock> { return { isOpen: true, timestamp: new Date().toISOString() }; }
}

const proposal: TradeProposal = { id: "p", symbol: "AAPL", action: "BUY", confidence: 80, entry: 100, stopLoss: 98, takeProfit: 104, riskReward: 2, positionSize: 0, thesis: "x", invalidation: "x", signalIds: [], createdAt: new Date().toISOString() };
const risk: RiskConfig = { maxRiskPerTradePercent: .5, maxDailyLossPercent: 2, maxTotalExposurePercent: 100, maxSinglePositionPercent: 35, maxOpenPositions: 3, minCashReservePercent: 10, maxSpreadBps: 35, maxQuoteAgeSeconds: 15, maxAtrPercent: 6, minAverageDollarVolume: 0, lossStreakCooldownCount: 3, lossStreakCooldownMinutes: 60, killSwitch: true };

test("ExecutionEngine cannot submit an order when deterministic Risk Engine rejects it", async () => {
  const market = new Market();
  const broker = new PaperBrokerAdapter(market, 20, 1);
  const now = new Date();
  const context: RiskContext = { now, account: await broker.getAccount(), positions: [], quote: await market.getQuote("AAPL"), marketClock: await market.getMarketClock(), dailyRealizedPnl: 0, consecutiveLosses: 0, totalExposure: 0, fxRateToAccountCurrency: 1 };
  const engine = new ExecutionEngine(broker, risk);
  const result = await engine.executeBuy(proposal, context);
  assert.equal(result.executed, false);
  assert.ok(result.risk.reasons.includes("KILL_SWITCH_ACTIVE"));
  assert.equal((await broker.getOrders()).length, 0);
});
