import { NextResponse } from "next/server";
import { assertCronAuth } from "@/security/request";
import { getRuntime } from "@/runtime/factory";
import { logEvent } from "@/logging/logger";
import { getEnv } from "@/config/env";

export async function GET(request: Request) {
  try {
    assertCronAuth(request, getEnv().CRON_SECRET);
    const { broker } = getRuntime();
    const positions = await broker.getPositions();
    const checks = await Promise.all(positions.map(async position => {
      const quote = await broker.getQuote(position.symbol);
      const stopBreached = quote.last <= position.stopLoss;
      const targetReached = quote.last >= position.takeProfit;
      return { symbol: position.symbol, last: quote.last, stopBreached, targetReached };
    }));
    // V1 monitor observes and audits. It does not auto-close while EXECUTION_MODE defaults to MANUAL.
    logEvent("info", "job.monitor.completed", { positions: checks.length, alerts: checks.filter(x => x.stopBreached || x.targetReached).length });
    return NextResponse.json({ ok: true, checks });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "monitor failed" }, { status: 401 });
  }
}
