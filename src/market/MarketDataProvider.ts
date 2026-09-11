import type { Candle, MarketClock, Quote } from "../domain/types";

export interface MarketDataProvider {
  readonly name: string;
  getQuote(symbol: string): Promise<Quote>;
  getCandles(symbol: string, timeframe: string, limit?: number): Promise<Candle[]>;
  getMarketClock(): Promise<MarketClock>;
}

export class MarketDataError extends Error {
  constructor(public readonly code: "RATE_LIMIT" | "MARKET_CLOSED" | "STALE_QUOTE" | "MISSING_CANDLES" | "NETWORK" | "UNAUTHORIZED", message: string) {
    super(message);
    this.name = "MarketDataError";
  }
}
