import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBacktest } from "../src/backtest/backtester";
import type { BacktestTrade } from "../src/domain/types";

function trade(netPnl: number, commission = 0.01, slippage = 0.02): BacktestTrade {
  return { symbol: "AAPL", enteredAt: "2026-01-01T00:00:00Z", exitedAt: "2026-01-01T01:00:00Z", entry: 100, exit: 100 + netPnl, quantity: 1, grossPnl: netPnl + commission, commission, slippage, netPnl };
}

test("backtest summary reports expectancy, costs and drawdown instead of win-rate alone", () => {
  const result = summarizeBacktest([trade(1), trade(-2), trade(1)], 20);
  assert.equal(result.tradeCount, 3);
  assert.equal(result.winRate, 2 / 3);
  assert.equal(result.expectancy, 0);
  assert.equal(result.finalCapital, 20);
  assert.ok(result.maxDrawdown > 0);
  assert.ok(result.commissions > 0);
  assert.ok(result.slippage > 0);
  assert.equal(result.sharpeRatio, null);
});
