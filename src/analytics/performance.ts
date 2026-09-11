import "server-only";
import { getEnv } from "../config/env";
import { db } from "../db/client";
import { logEvent } from "../logging/logger";

export interface PerformanceSummary {
  mode: "paper" | "live";
  equityCurve: number[];
  tradeCount: number;
  totalReturn: number | null;
  winRate: number | null;
  profitFactor: number | null;
  maxDrawdown: number | null;
  expectancy: number | null;
}

export function emptyPerformance(mode: "paper" | "live", initial?: number): PerformanceSummary {
  return { mode, equityCurve: initial != null ? [initial] : [], tradeCount: 0, totalReturn: null, winRate: null, profitFactor: null, maxDrawdown: null, expectancy: null };
}

export async function getPerformanceSummary(mode: "paper" | "live", demoInitial?: number): Promise<PerformanceSummary> {
  const env = getEnv();
  if (!env.DATABASE_URL) return emptyPerformance(mode, mode === "paper" ? demoInitial : undefined);
  try {
    const sql = db();
    const [daily, trades] = await Promise.all([
      sql<{ equity_open: string | number; equity_close: string | number; max_drawdown: string | number }[]>`
        select equity_open, equity_close, max_drawdown
        from daily_metrics where mode = ${mode} order by day asc
      `,
      sql<{ pnl: string | number; fees: string | number; slippage: string | number }[]>`
        select pnl, fees, slippage from trades
        where mode = ${mode} and closed_at is not null and pnl is not null order by closed_at asc
      `
    ]);
    const curve = daily.map(row => Number(row.equity_close)).filter(Number.isFinite);
    const nets = trades.map(row => Number(row.pnl) - Number(row.fees) - Number(row.slippage)).filter(Number.isFinite);
    const wins = nets.filter(value => value > 0);
    const losses = nets.filter(value => value < 0);
    const grossWins = wins.reduce((a, b) => a + b, 0);
    const grossLosses = Math.abs(losses.reduce((a, b) => a + b, 0));
    const initial = daily.length ? Number(daily[0].equity_open) : undefined;
    const final = curve.at(-1);
    let peak = initial ?? curve[0] ?? 0;
    let drawdown = 0;
    for (const equity of curve) {
      peak = Math.max(peak, equity);
      if (peak > 0) drawdown = Math.max(drawdown, (peak - equity) / peak);
    }
    const storedDd = daily.reduce((max, row) => Math.max(max, Number(row.max_drawdown) || 0), 0);
    return {
      mode,
      equityCurve: curve,
      tradeCount: nets.length,
      totalReturn: initial && final != null ? (final - initial) / initial : null,
      winRate: nets.length ? wins.length / nets.length : null,
      profitFactor: grossLosses > 0 ? grossWins / grossLosses : wins.length ? null : nets.length ? 0 : null,
      maxDrawdown: daily.length ? Math.max(drawdown, storedDd) : null,
      expectancy: nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : null
    };
  } catch (error) {
    logEvent("error", "performance.read_failed", { mode, error: error instanceof Error ? error.message : "unknown" });
    return emptyPerformance(mode, mode === "paper" ? demoInitial : undefined);
  }
}
