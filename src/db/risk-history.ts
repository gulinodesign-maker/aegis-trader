import "server-only";
import { getEnv } from "../config/env";
import { db } from "./client";
import { logEvent } from "../logging/logger";

export interface RiskHistorySnapshot {
  dailyRealizedPnl: number;
  consecutiveLosses: number;
  lastLossAt?: Date;
}

export async function getRiskHistory(mode: "paper" | "live"): Promise<RiskHistorySnapshot> {
  if (!getEnv().DATABASE_URL) return { dailyRealizedPnl: 0, consecutiveLosses: 0 };
  try {
    const sql = db();
    const [daily, recent] = await Promise.all([
      sql<{ realized: string | number | null }[]>`
        select coalesce(sum(pnl - fees - slippage), 0) as realized
        from trades
        where mode = ${mode} and closed_at >= date_trunc('day', now()) and pnl is not null
      `,
      sql<{ pnl: string | number | null; fees: string | number; slippage: string | number; closed_at: Date | string | null }[]>`
        select pnl, fees, slippage, closed_at
        from trades
        where mode = ${mode} and closed_at is not null and pnl is not null
        order by closed_at desc
        limit 20
      `
    ]);
    let consecutiveLosses = 0;
    let lastLossAt: Date | undefined;
    for (const row of recent) {
      const net = Number(row.pnl ?? 0) - Number(row.fees ?? 0) - Number(row.slippage ?? 0);
      if (net < 0) {
        consecutiveLosses += 1;
        if (!lastLossAt && row.closed_at) lastLossAt = new Date(row.closed_at);
      } else break;
    }
    return { dailyRealizedPnl: Number(daily[0]?.realized ?? 0), consecutiveLosses, lastLossAt };
  } catch (error) {
    // Fail conservatively: caller also uses broker day P&L for the daily-loss gate.
    logEvent("error", "risk.history_read_failed", { mode, error: error instanceof Error ? error.message : "unknown" });
    return { dailyRealizedPnl: 0, consecutiveLosses: 0 };
  }
}
