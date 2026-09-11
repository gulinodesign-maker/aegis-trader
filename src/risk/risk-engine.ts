import type { RiskConfig, RiskContext, RiskDecision, TradeProposal } from "../domain/types";
import { calculatePositionSize } from "./position-sizing";

export interface EvaluateRiskOptions {
  supportsFractional: boolean;
  minAverageDollarVolume?: number;
  observedAverageDollarVolume?: number;
  observedAtrPercent?: number;
}

export function spreadBps(bid: number, ask: number) {
  if (bid <= 0 || ask <= 0 || ask < bid) return Number.POSITIVE_INFINITY;
  const mid = (bid + ask) / 2;
  return ((ask - bid) / mid) * 10_000;
}

export function quoteAgeSeconds(now: Date, timestamp: string) {
  const ms = now.getTime() - Date.parse(timestamp);
  return Number.isFinite(ms) ? Math.max(0, ms / 1000) : Number.POSITIVE_INFINITY;
}

export function evaluateTradeRisk(
  proposal: TradeProposal,
  context: RiskContext,
  config: RiskConfig,
  options: EvaluateRiskOptions
): RiskDecision {
  const reasons: string[] = [];

  if (config.killSwitch) reasons.push("KILL_SWITCH_ACTIVE");
  if (proposal.action !== "BUY") reasons.push("NOT_A_BUY_PROPOSAL");
  if (!proposal.stopLoss || proposal.stopLoss <= 0) reasons.push("STOP_LOSS_REQUIRED");
  if (proposal.entry <= proposal.stopLoss) reasons.push("LONG_STOP_MUST_BE_BELOW_ENTRY");
  if (proposal.takeProfit <= proposal.entry) reasons.push("LONG_TARGET_MUST_BE_ABOVE_ENTRY");
  if (!context.marketClock.isOpen) reasons.push("MARKET_CLOSED");

  if (quoteAgeSeconds(context.now, context.quote.timestamp) > config.maxQuoteAgeSeconds) reasons.push("STALE_QUOTE");
  if (spreadBps(context.quote.bid, context.quote.ask) > config.maxSpreadBps) reasons.push("SPREAD_TOO_WIDE");
  if (!Number.isFinite(context.fxRateToAccountCurrency) || context.fxRateToAccountCurrency <= 0) reasons.push("FX_RATE_UNAVAILABLE");

  const sameSymbol = context.positions.some(position => position.symbol === proposal.symbol);
  if (!sameSymbol && context.positions.length >= config.maxOpenPositions) reasons.push("MAX_OPEN_POSITIONS");

  const dailyLossLimit = context.account.equity * (config.maxDailyLossPercent / 100);
  if (context.dailyRealizedPnl <= -dailyLossLimit) reasons.push("MAX_DAILY_LOSS");

  if (context.consecutiveLosses >= config.lossStreakCooldownCount && context.lastLossAt) {
    const cooldownMs = config.lossStreakCooldownMinutes * 60_000;
    if (context.now.getTime() - context.lastLossAt.getTime() < cooldownMs) reasons.push("LOSS_STREAK_COOLDOWN");
  }

  if (proposal.entry > 0 && context.quote.ask > 0) {
    const deviationBps = Math.abs(context.quote.ask - proposal.entry) / proposal.entry * 10_000;
    if (deviationBps > Math.max(config.maxSpreadBps * 2, 50)) reasons.push("ENTRY_PRICE_MOVED");
  }

  const position = calculatePositionSize({
    accountEquity: context.account.equity,
    cash: context.account.cash,
    entry: proposal.entry,
    stop: proposal.stopLoss,
    riskPercent: config.maxRiskPerTradePercent,
    minCashReservePercent: config.minCashReservePercent,
    maxSinglePositionPercent: config.maxSinglePositionPercent,
    fxRateToAccountCurrency: context.fxRateToAccountCurrency,
    supportsFractional: options.supportsFractional
  });

  if (position.quantity <= 0) reasons.push("INSUFFICIENT_SPENDABLE_CASH");
  const exposureAfter = context.totalExposure + position.notionalAccountCurrency;
  const maxExposure = context.account.equity * (config.maxTotalExposurePercent / 100);
  if (exposureAfter > maxExposure + 1e-8) reasons.push("MAX_TOTAL_EXPOSURE");

  const minLiquidity = options.minAverageDollarVolume ?? config.minAverageDollarVolume;
  if (minLiquidity > 0 && (options.observedAverageDollarVolume ?? 0) < minLiquidity) reasons.push("INSUFFICIENT_LIQUIDITY");
  if (options.observedAtrPercent != null && !volatilityAllowed(options.observedAtrPercent, config)) reasons.push("VOLATILITY_TOO_HIGH");

  return {
    approved: reasons.length === 0,
    reasons,
    quantity: reasons.length === 0 ? position.quantity : 0,
    riskCapital: position.riskCapital,
    maxLoss: reasons.length === 0 ? position.maxLoss : 0,
    exposureAfter
  };
}

export function volatilityAllowed(atrPercent: number, config: Pick<RiskConfig, "maxAtrPercent">) {
  return Number.isFinite(atrPercent) && atrPercent >= 0 && atrPercent <= config.maxAtrPercent;
}
