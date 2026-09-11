import "server-only";
import type { RiskContext, Signal, TradeProposal } from "../domain/types";
import { getRuntime } from "../runtime/factory";
import { generateSignal } from "../signal/signal-engine";
import { getRiskHistory } from "../db/risk-history";

export async function buildExecutionContext(proposal: TradeProposal): Promise<{ context: RiskContext; signal?: Signal; fxRateToAccountCurrency: number; observedAverageDollarVolume?: number }> {
  const { broker, marketData, fxRateToAccountCurrency } = getRuntime();
  const [account, positions, quote, marketClock] = await Promise.all([
    broker.getAccount(), broker.getPositions(), marketData.getQuote(proposal.symbol), marketData.getMarketClock()
  ]);
  let signal: Signal | undefined;
  let observedAverageDollarVolume: number | undefined;
  try {
    const candles = await marketData.getCandles(proposal.symbol, "5Min", 200);
    signal = generateSignal(candles) ?? undefined;
    const sample = candles.slice(-20);
    if (sample.length) observedAverageDollarVolume = sample.reduce((sum, candle) => sum + candle.close * candle.volume, 0) / sample.length;
  } catch {
    // Risk still has quote/clock checks; missing candles are not fabricated.
  }
  const history = await getRiskHistory(account.mode);
  return {
    context: {
      now: new Date(), account, positions, quote, marketClock,
      // Use the worse of broker day P&L (often includes unrealized P&L) and realized DB P&L.
      dailyRealizedPnl: Math.min(account.todayPnl, history.dailyRealizedPnl),
      consecutiveLosses: history.consecutiveLosses,
      lastLossAt: history.lastLossAt,
      totalExposure: positions.reduce((sum, p) => sum + p.marketValue, 0),
      fxRateToAccountCurrency
    },
    signal,
    fxRateToAccountCurrency,
    observedAverageDollarVolume
  };
}
