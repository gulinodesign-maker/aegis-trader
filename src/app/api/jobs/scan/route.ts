import { NextResponse } from "next/server";
import { assertCronAuth } from "@/security/request";
import { getRuntime } from "@/runtime/factory";
import { generateSignal } from "@/signal/signal-engine";
import { getEnv } from "@/config/env";
import { logEvent } from "@/logging/logger";

const UNIVERSE = ["AAPL", "MSFT", "NVDA"];

export async function GET(request: Request) {
  try {
    assertCronAuth(request, getEnv().CRON_SECRET);
    const env = getEnv();
    if (env.DEMO_MODE) return NextResponse.json({ ok: true, skipped: true, reason: "DEMO_MODE uses fixed synthetic scan data." });
    const { marketData } = getRuntime();
    const signals = [];
    for (const symbol of UNIVERSE) {
      const candles = await marketData.getCandles(symbol, "15Min", 120);
      const signal = generateSignal(candles);
      if (signal) signals.push(signal);
    }
    logEvent("info", "job.scan.completed", { count: signals.length });
    return NextResponse.json({ ok: true, signals });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "scan failed" }, { status: 401 });
  }
}
