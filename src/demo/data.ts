import type { AccountSnapshot, Candle, Position, Signal } from "@/domain/types";

const now = "2026-09-11T19:00:00.000Z";

export const demoAccount: AccountSnapshot = {
  id: "demo-paper",
  currency: "EUR",
  equity: 20,
  cash: 20,
  buyingPower: 18,
  todayPnl: 0,
  totalPnl: 0,
  mode: "paper"
};

export const demoSignals: Signal[] = [
  {
    id: "sig-aapl-demo",
    symbol: "AAPL",
    direction: "LONG",
    score: 84,
    entry: 231.42,
    stop: 228.95,
    target: 237.35,
    riskReward: 2.4,
    reasons: ["EMA 20 sopra EMA 50", "Breakout sopra resistenza intraday", "Volume relativo 1.7×", "RSI positivo ma non estremo"],
    invalidations: ["Chiusura sotto 228.95", "Spread oltre 35 bps", "Quote più vecchia di 15 secondi"],
    metrics: {
      symbol: "AAPL",
      emaFast: 230.61,
      emaSlow: 228.84,
      rsi: 61.8,
      atr: 2.31,
      atrPercent: 1.0,
      relativeVolume: 1.7,
      support: 228.95,
      resistance: 231.1,
      vwap: 230.44,
      trend: "UP",
      volatility: "NORMAL"
    },
    generatedAt: now,
    dataTimestamp: now,
    origin: "DEMO"
  },
  {
    id: "sig-msft-demo",
    symbol: "MSFT",
    direction: "LONG",
    score: 77,
    entry: 511.18,
    stop: 505.8,
    target: 522.0,
    riskReward: 2.01,
    reasons: ["Trend rialzista", "Prezzo sopra VWAP", "Momentum 20 periodi positivo"],
    invalidations: ["Perdita VWAP con volume", "ATR > 6%", "Mercato chiuso"],
    metrics: {
      symbol: "MSFT",
      emaFast: 509.9,
      emaSlow: 504.2,
      rsi: 58.4,
      atr: 5.1,
      atrPercent: 1.0,
      relativeVolume: 1.3,
      support: 505.8,
      resistance: 512.0,
      vwap: 509.2,
      trend: "UP",
      volatility: "NORMAL"
    },
    generatedAt: now,
    dataTimestamp: now,
    origin: "DEMO"
  },
  {
    id: "sig-nvda-demo",
    symbol: "NVDA",
    direction: "LONG",
    score: 71,
    entry: 179.56,
    stop: 176.92,
    target: 184.84,
    riskReward: 2.0,
    reasons: ["Momentum positivo", "Volume anomalo 1.9×", "Tenuta supporto breve"],
    invalidations: ["Rottura di 176.92", "Volatilità oltre limite", "Spread oltre limite"],
    metrics: {
      symbol: "NVDA",
      emaFast: 178.8,
      emaSlow: 176.6,
      rsi: 64.9,
      atr: 2.62,
      atrPercent: 1.46,
      relativeVolume: 1.9,
      support: 176.92,
      resistance: 179.4,
      vwap: 178.36,
      trend: "UP",
      volatility: "NORMAL"
    },
    generatedAt: now,
    dataTimestamp: now,
    origin: "DEMO"
  }
];

export const demoPositions: Position[] = [];

export function demoCandles(symbol: string): Candle[] {
  const base = symbol === "AAPL" ? 228 : symbol === "MSFT" ? 503 : 175;
  return Array.from({ length: 40 }, (_, index) => {
    const drift = index * 0.12;
    const wave = Math.sin(index / 3) * 0.7;
    const close = base + drift + wave;
    return {
      symbol,
      timeframe: "5Min",
      timestamp: new Date(Date.parse(now) - (39 - index) * 300_000).toISOString(),
      open: close - Math.sin(index) * 0.35,
      high: close + 0.65,
      low: close - 0.72,
      close,
      volume: Math.round(700_000 + Math.abs(Math.cos(index / 2)) * 400_000),
      vwap: close - 0.25,
      origin: "DEMO"
    };
  });
}

export function demoHistoricalCandles(symbol: string, count = 360): Candle[] {
  const base = symbol === "AAPL" ? 214 : symbol === "MSFT" ? 475 : 158;
  return Array.from({ length: count }, (_, index) => {
    const regime = index < count * 0.33 ? index * 0.035 : index < count * 0.66 ? count * 0.33 * 0.035 - (index - count * 0.33) * 0.018 : count * 0.33 * 0.035 - count * 0.33 * 0.018 + (index - count * 0.66) * 0.06;
    const wave = Math.sin(index / 5) * 1.15 + Math.sin(index / 17) * 0.65;
    const close = Math.max(10, base + regime + wave);
    const open = close - Math.sin(index / 2.7) * 0.42;
    const high = Math.max(open, close) + 0.55 + Math.abs(Math.sin(index / 4)) * 0.35;
    const low = Math.min(open, close) - 0.55 - Math.abs(Math.cos(index / 4)) * 0.35;
    return {
      symbol, timeframe: "5Min", timestamp: new Date(Date.parse(now) - (count - 1 - index) * 300_000).toISOString(),
      open, high, low, close, volume: Math.round(500_000 + Math.abs(Math.cos(index / 7)) * 600_000 + (index % 53 === 0 ? 700_000 : 0)),
      vwap: (open + high + low + close) / 4, origin: "DEMO"
    };
  });
}
