import "server-only";
import { DemoMarketDataProvider } from "../market/DemoMarketDataProvider";
import { AlpacaMarketDataProvider } from "../market/AlpacaMarketDataProvider";
import { PaperBrokerAdapter } from "../broker/PaperBrokerAdapter";
import { AlpacaBrokerAdapter } from "../broker/AlpacaBrokerAdapter";
import type { BrokerAdapter } from "../broker/BrokerAdapter";
import type { MarketDataProvider } from "../market/MarketDataProvider";
import { getEnv } from "../config/env";

type Runtime = { marketData: MarketDataProvider; broker: BrokerAdapter; fxRateToAccountCurrency: number };
const globalForRuntime = globalThis as typeof globalThis & { __aegisRuntime?: Runtime };

export function getRuntime(): Runtime {
  if (globalForRuntime.__aegisRuntime) return globalForRuntime.__aegisRuntime;
  const env = getEnv();
  if (env.DEMO_MODE) {
    const marketData = new DemoMarketDataProvider();
    const fxRateToAccountCurrency = 0.92; // DEMO DATA only, never presented as live FX.
    globalForRuntime.__aegisRuntime = { marketData, broker: new PaperBrokerAdapter(marketData, env.INITIAL_CAPITAL_EUR, fxRateToAccountCurrency), fxRateToAccountCurrency };
    return globalForRuntime.__aegisRuntime;
  }
  if (!env.ALPACA_API_KEY || !env.ALPACA_API_SECRET) throw new Error("ALPACA_CREDENTIALS_REQUIRED_OUTSIDE_DEMO");
  const baseUrl = env.TRADING_MODE === "live" ? env.ALPACA_LIVE_BASE_URL : env.ALPACA_PAPER_BASE_URL;
  const marketData = new AlpacaMarketDataProvider({ key: env.ALPACA_API_KEY, secret: env.ALPACA_API_SECRET, dataBaseUrl: env.ALPACA_DATA_BASE_URL, tradingBaseUrl: baseUrl });
  const broker = env.BROKER_PROVIDER === "alpaca"
    ? new AlpacaBrokerAdapter({ key: env.ALPACA_API_KEY, secret: env.ALPACA_API_SECRET, baseUrl, mode: env.TRADING_MODE }, marketData)
    : new PaperBrokerAdapter(marketData, env.INITIAL_CAPITAL_EUR, 1);
  globalForRuntime.__aegisRuntime = { marketData, broker, fxRateToAccountCurrency: env.BROKER_PROVIDER === "alpaca" ? 1 : 1 };
  return globalForRuntime.__aegisRuntime;
}
