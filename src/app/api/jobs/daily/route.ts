import { NextResponse } from "next/server";
import { assertCronAuth } from "@/security/request";
import { getRuntime } from "@/runtime/factory";
import { logEvent } from "@/logging/logger";
import { getEnv } from "@/config/env";

export async function GET(request: Request) {
  try {
    assertCronAuth(request, getEnv().CRON_SECRET);
    const { broker } = getRuntime();
    const account = await broker.getAccount();
    const positions = await broker.getPositions();
    const exposure = positions.reduce((sum, position) => sum + position.marketValue, 0);
    const snapshot = { timestamp: new Date().toISOString(), mode: account.mode, equity: account.equity, cash: account.cash, pnl: account.todayPnl, exposure, openPositions: positions.length };
    logEvent("info", "job.daily.snapshot", snapshot);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "daily failed" }, { status: 401 });
  }
}
