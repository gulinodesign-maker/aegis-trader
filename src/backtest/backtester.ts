import type { BacktestResult, BacktestTrade, Candle } from "../domain/types";

export interface BacktestConfig {
  initialCapital: number;
  riskPercent: number;
  commissionPerTrade: number;
  slippageBps: number;
  stopAtrMultiple: number;
  targetRiskReward: number;
  /** Account-currency units per quote-currency unit. */
  fxRateToAccountCurrency?: number;
  /** V1 long-only backtests are cash constrained; defaults to 90% to retain the configured reserve. */
  maxInvestedPercent?: number;
}

export interface BacktestSignalPoint { index: number; score: number; atr: number; }

export function summarizeBacktest(trades: BacktestTrade[], initialCapital: number): BacktestResult {
  const wins = trades.filter(t => t.netPnl > 0);
  const losses = trades.filter(t => t.netPnl < 0);
  const totalNet = trades.reduce((s, t) => s + t.netPnl, 0);
  const averageWin = wins.length ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : 0;
  const averageLoss = losses.length ? losses.reduce((s, t) => s + t.netPnl, 0) / losses.length : 0;
  const grossWins = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const returns = trades.map(t => t.netPnl / Math.max(initialCapital, 1e-9));
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 1 ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1) : 0;
  const std = Math.sqrt(variance);
  const sharpeRatio = returns.length >= 20 && std > 0 ? mean / std * Math.sqrt(252) : null;

  let equity = initialCapital, peak = initialCapital, maxDd = 0;
  for (const trade of trades) {
    equity += trade.netPnl;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak > 0 ? (peak - equity) / peak : 0);
  }

  return {
    trades,
    tradeCount: trades.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    averageWin,
    averageLoss,
    expectancy: trades.length ? totalNet / trades.length : 0,
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : wins.length ? null : 0,
    sharpeRatio,
    maxDrawdown: maxDd,
    initialCapital,
    finalCapital: initialCapital + totalNet,
    commissions: trades.reduce((s, t) => s + t.commission, 0),
    slippage: trades.reduce((s, t) => s + t.slippage, 0)
  };
}

export function backtestLongSignals(candles: Candle[], signals: BacktestSignalPoint[], config: BacktestConfig): BacktestResult {
  let equity = config.initialCapital;
  const trades: BacktestTrade[] = [];
  const fx = config.fxRateToAccountCurrency ?? 1;
  const maxInvestedPercent = config.maxInvestedPercent ?? 90;
  let nextEligibleIndex = 0;

  for (const signal of [...signals].sort((a, b) => a.index - b.index)) {
    if (signal.score < 70 || signal.index < nextEligibleIndex || signal.index < 0 || signal.index >= candles.length - 1 || signal.atr <= 0) continue;
    if (!Number.isFinite(fx) || fx <= 0 || equity <= 0) break;

    const entryCandle = candles[signal.index + 1];
    const rawEntry = entryCandle.open;
    const entry = rawEntry * (1 + config.slippageBps / 10_000);
    const stop = entry - signal.atr * config.stopAtrMultiple;
    const target = entry + (entry - stop) * config.targetRiskReward;
    const riskCapital = equity * (config.riskPercent / 100);
    const riskPerShareAccount = Math.max((entry - stop) * fx, 1e-9);
    const riskQty = riskCapital / riskPerShareAccount;
    const cashQty = equity * (maxInvestedPercent / 100) / Math.max(entry * fx, 1e-9);
    const qty = Math.max(0, Math.min(riskQty, cashQty));
    if (qty <= 0) continue;

    let exit = candles.at(-1)!.close;
    let exitIndex = candles.length - 1;
    for (let i = signal.index + 1; i < candles.length; i++) {
      const c = candles[i];
      if (c.low <= stop) { exit = stop; exitIndex = i; break; }
      if (c.high >= target) { exit = target; exitIndex = i; break; }
    }
    const slippedExit = exit * (1 - config.slippageBps / 10_000);
    const grossPnl = (slippedExit - entry) * qty * fx;
    const commission = config.commissionPerTrade * 2;
    const slippage = (Math.abs(entry - rawEntry) * qty + Math.abs(slippedExit - exit) * qty) * fx;
    const netPnl = grossPnl - commission;
    equity += netPnl;
    trades.push({ symbol: entryCandle.symbol, enteredAt: entryCandle.timestamp, exitedAt: candles[exitIndex].timestamp, entry, exit: slippedExit, quantity: qty, grossPnl, commission, slippage, netPnl });
    nextEligibleIndex = exitIndex + 1;
  }
  return summarizeBacktest(trades, config.initialCapital);
}
