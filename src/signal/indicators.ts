import type { Candle } from "../domain/types";

export function ema(values: number[], period: number) {
  if (period <= 0 || values.length < period) return null;
  const k = 2 / (period + 1);
  let result = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (const value of values.slice(period)) result = value * k + result * (1 - k);
  return result;
}

export function rsi(values: number[], period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change; else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function atr(candles: Candle[], period = 14) {
  if (candles.length <= period) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function vwap(candles: Candle[]) {
  let totalPv = 0;
  let totalVolume = 0;
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    totalPv += typical * c.volume;
    totalVolume += c.volume;
  }
  return totalVolume > 0 ? totalPv / totalVolume : null;
}

export function relativeVolume(candles: Candle[], lookback = 20) {
  if (candles.length < 2) return null;
  const latest = candles.at(-1)!.volume;
  const prior = candles.slice(-lookback - 1, -1);
  if (!prior.length) return null;
  const avg = prior.reduce((sum, c) => sum + c.volume, 0) / prior.length;
  return avg > 0 ? latest / avg : null;
}

export function supportResistance(candles: Candle[], lookback = 20) {
  const slice = candles.slice(-lookback);
  if (!slice.length) return null;
  return {
    support: Math.min(...slice.map(c => c.low)),
    resistance: Math.max(...slice.slice(0, -1).map(c => c.high))
  };
}

export function momentum(values: number[], period = 10) {
  if (values.length <= period) return null;
  const previous = values.at(-(period + 1))!;
  const current = values.at(-1)!;
  return previous !== 0 ? ((current - previous) / previous) * 100 : null;
}
