import type { Signal, TradeAction, TradeProposal } from "../domain/types";
import { demoSignals } from "./data";

const DEMO_PREFIX = "demo-agent";

export function buildDemoProposal(signal: Signal, action: TradeAction = "BUY"): TradeProposal {
  const createdAt = signal.dataTimestamp;
  return {
    id: `${DEMO_PREFIX}:${signal.symbol}:${action}:${signal.id}`,
    symbol: signal.symbol,
    action,
    confidence: signal.score,
    entry: signal.entry,
    stopLoss: signal.stop,
    takeProfit: signal.target,
    riskReward: signal.riskReward,
    positionSize: 0,
    thesis: `DEMO DATA: ${signal.reasons.join("; ")}`,
    invalidation: signal.invalidations.join("; "),
    signalIds: [signal.id],
    createdAt
  };
}

export function reconstructDemoProposal(externalId: string): TradeProposal | null {
  const match = /^demo-agent:([A-Z0-9.-]+):(BUY|WAIT|CLOSE):(.+)$/.exec(externalId);
  if (!match) return null;
  const [, symbol, action, signalId] = match;
  const signal = demoSignals.find(item => item.symbol === symbol && item.id === signalId);
  if (!signal) return null;
  return buildDemoProposal(signal, action as TradeAction);
}
