import test from "node:test";
import assert from "node:assert/strict";
import { PaperBrokerAdapter } from "../src/broker/PaperBrokerAdapter";
import type { MarketDataProvider } from "../src/market/MarketDataProvider";
import type { Candle, MarketClock, Quote } from "../src/domain/types";

class MockMarketData implements MarketDataProvider {
  readonly name = "mock";
  quote: Quote = { symbol: "AAPL", bid: 99.9, ask: 100, last: 99.95, currency: "USD", origin: "DEMO", timestamp: new Date().toISOString() };
  async getQuote(): Promise<Quote> { return { ...this.quote, timestamp: new Date().toISOString() }; }
  async getCandles(): Promise<Candle[]> { return []; }
  async getMarketClock(): Promise<MarketClock> { return { isOpen: true, timestamp: new Date().toISOString() }; }
}

test("PaperBrokerAdapter fills a fractional long and prevents duplicates", async () => {
  const market = new MockMarketData();
  const broker = new PaperBrokerAdapter(market, 20, 1);
  const request = { symbol: "AAPL", side: "BUY" as const, quantity: 0.05, type: "MARKET" as const, stopLoss: 98, takeProfit: 104, clientOrderId: "client-1", idempotencyKey: "idem-1" };
  const order = await broker.submitOrder(request);
  assert.equal(order.status, "FILLED");
  assert.equal(order.quantity, 0.05);
  const account = await broker.getAccount();
  assert.equal(account.cash, 15);
  const positions = await broker.getPositions();
  assert.equal(positions.length, 1);
  assert.equal(positions[0]?.symbol, "AAPL");
  await assert.rejects(() => broker.submitOrder(request), /DUPLICATE_ORDER/);
});

test("PaperBrokerAdapter requires a stop", async () => {
  const broker = new PaperBrokerAdapter(new MockMarketData(), 20, 1);
  await assert.rejects(() => broker.submitOrder({ symbol: "AAPL", side: "BUY", quantity: 0.01, type: "MARKET", stopLoss: 0, takeProfit: 104, clientOrderId: "x", idempotencyKey: "y" }), /STOP_LOSS_REQUIRED/);
});
