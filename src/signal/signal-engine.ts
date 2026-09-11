import { randomUUID } from "node:crypto";
import type { AssetMetrics, Candle, Signal } from "../domain/types";
import { atr, ema, momentum, relativeVolume, rsi, supportResistance, vwap } from "./indicators";
import { calculateRiskReward } from "../risk/position-sizing";

export function calculateAssetMetrics(candles: Candle[]): AssetMetrics | null {
  if (candles.length < 55) return null;
  const closes = candles.map(c => c.close);
  const fast = ema(closes, 20);
  const slow = ema(closes, 50);
  const strength = rsi(closes, 14);
  const averageRange = atr(candles, 14);
  const relVolume = relativeVolume(candles, 20);
  const levels = supportResistance(candles, 20);
  const weighted = vwap(candles);
  const current = closes.at(-1)!;
  if ([fast, slow, strength, averageRange, relVolume].some(x => x == null) || !levels) return null;
  const trend = fast! > slow! * 1.001 ? "UP" : fast! < slow! * 0.999 ? "DOWN" : "FLAT";
  const atrPercent = averageRange! / current * 100;
  return {
    symbol: candles[0].symbol,
    emaFast: fast!,
    emaSlow: slow!,
    rsi: strength!,
    atr: averageRange!,
    atrPercent,
    relativeVolume: relVolume!,
    support: levels.support,
    resistance: levels.resistance,
    vwap: weighted ?? undefined,
    trend,
    volatility: atrPercent > 4 ? "HIGH" : atrPercent < 0.8 ? "LOW" : "NORMAL"
  };
}


export function calculateLongStop(entry: number, atrValue: number, support: number, atrMultiple = 1.5, tickSize = 0.01) {
  if (![entry, atrValue, support, atrMultiple, tickSize].every(Number.isFinite) || entry <= 0 || atrValue <= 0 || atrMultiple <= 0 || tickSize <= 0) return 0;
  const atrStop = entry - atrValue * atrMultiple;
  const candidate = Math.max(support, atrStop);
  const stop = Math.max(tickSize, Math.min(entry - tickSize, candidate));
  return Number(stop.toFixed(8));
}

export function generateSignal(candles: Candle[], now = new Date()): Signal | null {
  const metrics = calculateAssetMetrics(candles);
  if (!metrics) return null;
  const closes = candles.map(c => c.close);
  const current = closes.at(-1)!;
  const mom = momentum(closes, 10) ?? 0;
  const previousResistance = metrics.resistance;
  const breakout = current > previousResistance;
  const aboveVwap = metrics.vwap ? current > metrics.vwap : false;

  let score = 0;
  const reasons: string[] = [];
  const invalidations: string[] = [];

  if (metrics.trend === "UP") { score += 25; reasons.push("EMA20 above EMA50"); }
  if (mom > 0.5) { score += Math.min(20, 10 + mom * 2); reasons.push("Positive 10-period momentum"); }
  if (breakout) { score += 20; reasons.push("Breakout above recent resistance"); }
  if (metrics.relativeVolume >= 1.5) { score += 15; reasons.push(`Relative volume ${metrics.relativeVolume.toFixed(1)}x`); }
  if (metrics.rsi >= 50 && metrics.rsi <= 70) { score += 10; reasons.push("RSI constructive without extreme overbought reading"); }
  if (aboveVwap) { score += 10; reasons.push("Price above VWAP"); }
  if (metrics.volatility === "HIGH") score -= 15;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const stop = calculateLongStop(current, metrics.atr, metrics.support);
  const risk = current - stop;
  const target = current + risk * 2;
  invalidations.push(`Close below ${stop.toFixed(2)}`, "Quote too stale", "Spread above risk limit", "Market closed");

  return {
    id: `sig-${randomUUID()}`,
    symbol: metrics.symbol,
    direction: "LONG",
    score,
    entry: current,
    stop,
    target,
    riskReward: calculateRiskReward(current, stop, target),
    reasons,
    invalidations,
    metrics,
    generatedAt: now.toISOString(),
    dataTimestamp: candles.at(-1)!.timestamp,
    origin: candles.at(-1)!.origin
  };
}
