import "server-only";
import { getEnv } from "../config/env";
import { demoAccount, demoSignals } from "../demo/data";
import type { AccountSnapshot, Position, Signal } from "../domain/types";
import { generateSignal } from "../signal/signal-engine";
import { getRuntime } from "./factory";

const DEFAULT_UNIVERSE = ["AAPL", "MSFT", "NVDA"];

export async function getDashboardSnapshot(): Promise<{
  account: AccountSnapshot;
  positions: Position[];
  signals: Signal[];
  origin: string;
  marketOpen: boolean;
}> {
  const env = getEnv();
  if (env.DEMO_MODE) {
    return { account: demoAccount, positions: [], signals: demoSignals, origin: "DEMO", marketOpen: true };
  }

  const { broker, marketData } = getRuntime();
  const [account, positions, marketClock] = await Promise.all([broker.getAccount(), broker.getPositions(), marketData.getMarketClock()]);
  const signals: Signal[] = [];
  for (const symbol of DEFAULT_UNIVERSE) {
    try {
      const candles = await marketData.getCandles(symbol, "5Min", 200);
      const signal = generateSignal(candles);
      if (signal) signals.push(signal);
    } catch {
      // One provider failure must not cause other scanner candidates to disappear.
    }
  }
  return { account, positions, signals: signals.sort((a, b) => b.score - a.score), origin: marketData.name.toUpperCase(), marketOpen: marketClock.isOpen };
}
