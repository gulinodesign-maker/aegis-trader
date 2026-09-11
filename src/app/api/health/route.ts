import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";

export async function GET() {
  const env = getEnv();
  return NextResponse.json({ ok: true, mode: env.TRADING_MODE, demo: env.DEMO_MODE, executionMode: env.EXECUTION_MODE, liveEnabled: env.TRADING_MODE === "live" });
}
