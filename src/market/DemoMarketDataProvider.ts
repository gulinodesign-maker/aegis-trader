import { demoCandles, demoSignals } from "../demo/data";
import type { MarketDataProvider } from "./MarketDataProvider";

export class DemoMarketDataProvider implements MarketDataProvider {
  readonly name = "demo";
  async getQuote(symbol: string) {
    const signal = demoSignals.find(s => s.symbol === symbol.toUpperCase());
    if (!signal) throw new Error(`Unknown demo symbol ${symbol}`);
    return { symbol: signal.symbol, bid: signal.entry - 0.02, ask: signal.entry + 0.02, last: signal.entry, currency: "USD" as const, timestamp: new Date().toISOString(), origin: "DEMO" as const };
  }
  async getCandles(symbol: string, timeframe: string, limit = 100) {
    return demoCandles(symbol.toUpperCase()).map(c => ({ ...c, timeframe })).slice(-limit);
  }
  async getMarketClock() { return { isOpen: true, timestamp: new Date().toISOString() }; }
}
