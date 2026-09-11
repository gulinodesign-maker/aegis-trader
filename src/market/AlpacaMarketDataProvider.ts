import "server-only";
import type { Candle, Quote } from "../domain/types";
import type { MarketDataProvider } from "./MarketDataProvider";
import { MarketDataError } from "./MarketDataProvider";

export class AlpacaMarketDataProvider implements MarketDataProvider {
  readonly name = "alpaca";
  constructor(private readonly config: { key: string; secret: string; dataBaseUrl: string; tradingBaseUrl: string }) {}

  private headers() { return { "APCA-API-KEY-ID": this.config.key, "APCA-API-SECRET-KEY": this.config.secret }; }
  private async json(url: string) {
    let response: Response;
    try { response = await fetch(url, { headers: this.headers(), cache: "no-store" }); }
    catch (error) { throw new MarketDataError("NETWORK", error instanceof Error ? error.message : "network failure"); }
    if (response.status === 429) throw new MarketDataError("RATE_LIMIT", "Alpaca rate limit reached");
    if (response.status === 401 || response.status === 403) throw new MarketDataError("UNAUTHORIZED", "Alpaca credentials rejected");
    if (!response.ok) throw new MarketDataError("NETWORK", `Alpaca HTTP ${response.status}`);
    return response.json();
  }

  async getQuote(symbol: string): Promise<Quote> {
    const data = await this.json(`${this.config.dataBaseUrl}/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`) as { quote?: { bp: number; ap: number; t: string } };
    if (!data.quote) throw new MarketDataError("STALE_QUOTE", "No latest quote returned");
    const mid = (data.quote.bp + data.quote.ap) / 2;
    return { symbol: symbol.toUpperCase(), bid: data.quote.bp, ask: data.quote.ap, last: mid, currency: "USD", timestamp: data.quote.t, origin: "ALPACA" };
  }

  async getCandles(symbol: string, timeframe: string, limit = 200): Promise<Candle[]> {
    const params = new URLSearchParams({ timeframe, limit: String(limit), adjustment: "raw", feed: "iex" });
    const data = await this.json(`${this.config.dataBaseUrl}/v2/stocks/${encodeURIComponent(symbol)}/bars?${params}`) as { bars?: Array<{ t: string; o: number; h: number; l: number; c: number; v: number; vw?: number }> };
    if (!data.bars?.length) throw new MarketDataError("MISSING_CANDLES", "No candles returned");
    return data.bars.map(bar => ({ symbol: symbol.toUpperCase(), timeframe, timestamp: bar.t, open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v, vwap: bar.vw, origin: "ALPACA" }));
  }

  async getMarketClock() {
    const data = await this.json(`${this.config.tradingBaseUrl}/v2/clock`) as { is_open: boolean; timestamp: string; next_open?: string; next_close?: string };
    return { isOpen: data.is_open, timestamp: data.timestamp, nextOpen: data.next_open, nextClose: data.next_close };
  }
}
