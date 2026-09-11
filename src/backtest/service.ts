import "server-only";
import type { BacktestResult, Candle } from "../domain/types";
import { getEnv, riskConfigFromEnv } from "../config/env";
import { demoHistoricalCandles } from "../demo/data";
import { getRuntime } from "../runtime/factory";
import { generateSignal } from "../signal/signal-engine";
import { backtestLongSignals, type BacktestSignalPoint } from "./backtester";

export async function runBacktestForSymbol(symbol: string): Promise<{ result: BacktestResult; origin: string; sampleCandles: number; currency: "EUR" | "USD" }> {
  const env = getEnv();
  const runtime = getRuntime();
  const account = await runtime.broker.getAccount();
  const candles: Candle[] = env.DEMO_MODE
    ? demoHistoricalCandles(symbol, 360)
    : await runtime.marketData.getCandles(symbol, "5Min", 500);
  const signals: BacktestSignalPoint[] = [];

  // Build each point using only candles available at that timestamp; no future candles enter signal generation.
  for (let index = 59; index < candles.length - 1; index += 6) {
    const history = candles.slice(0, index + 1);
    const signal = generateSignal(history, new Date(candles[index].timestamp));
    if (signal) signals.push({ index, score: signal.score, atr: signal.metrics.atr });
  }

  const risk = riskConfigFromEnv();
  const result = backtestLongSignals(candles, signals, {
    initialCapital: env.DEMO_MODE ? env.INITIAL_CAPITAL_EUR : Math.min(env.INITIAL_CAPITAL_EUR, account.equity),
    riskPercent: risk.maxRiskPerTradePercent,
    commissionPerTrade: env.BACKTEST_COMMISSION_PER_ORDER,
    slippageBps: env.BACKTEST_SLIPPAGE_BPS,
    stopAtrMultiple: 1.5,
    targetRiskReward: 2,
    fxRateToAccountCurrency: runtime.fxRateToAccountCurrency,
    maxInvestedPercent: 100 - risk.minCashReservePercent
  });
  return { result, origin: env.DEMO_MODE ? "DEMO" : runtime.marketData.name.toUpperCase(), sampleCandles: candles.length, currency: env.DEMO_MODE ? "EUR" : account.currency };
}
