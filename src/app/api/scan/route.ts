import { NextResponse } from "next/server";
import { getRuntime } from "@/runtime/factory";
import { getEnv } from "@/config/env";
import { demoSignals } from "@/demo/data";
import { generateSignal } from "@/signal/signal-engine";
import { assertAuthorizedRequest } from "@/security/auth";

const UNIVERSE = ["AAPL", "MSFT", "NVDA"];

export async function GET(request: Request) {
  assertAuthorizedRequest(request);
  const env = getEnv();
  if (env.DEMO_MODE) return NextResponse.json({ origin: "DEMO", signals: demoSignals });
  const { marketData } = getRuntime();
  const signals = [];
  for (const symbol of UNIVERSE) {
    const candles = await marketData.getCandles(symbol, "5Min", 200);
    const signal = generateSignal(candles);
    if (signal) signals.push(signal);
  }
  return NextResponse.json({ origin: marketData.name, signals: signals.sort((a, b) => b.score - a.score) });
}
