import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { Sparkline } from "@/components/sparkline";
import { getEnv } from "@/config/env";
import { demoAccount } from "@/demo/data";
import { getRuntime } from "@/runtime/factory";
import { getPerformanceSummary, type PerformanceSummary } from "@/analytics/performance";
import { calculateWithdrawableProfit } from "@/profit/profit-sweep";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const env = getEnv();
  const runtime = getRuntime();
  const [account, positions, paperPerformance, livePerformance] = env.DEMO_MODE
    ? [demoAccount, [], await getPerformanceSummary("paper", env.INITIAL_CAPITAL_EUR), await getPerformanceSummary("live")]
    : await Promise.all([runtime.broker.getAccount(), runtime.broker.getPositions(), getPerformanceSummary("paper"), getPerformanceSummary("live")]);
  const invested = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const symbol = account.currency === "EUR" ? "€" : "$";
  const withdrawable = account.currency === "EUR" ? calculateWithdrawableProfit({
    equity: account.equity,
    authorizedCapital: env.INITIAL_CAPITAL_EUR,
    threshold: env.PROFIT_SWEEP_THRESHOLD_EUR,
    sweepPercent: env.PROFIT_SWEEP_PERCENT,
    enabled: env.PROFIT_SWEEP_ENABLED
  }) : null;

  return (
    <AppShell title="Portfolio" subtitle="Paper and live are never mixed">
      <section className="mt-2 grid grid-cols-2 gap-2">
        <MetricCard label="Equity" value={`${symbol}${account.equity.toFixed(2)}`} />
        <MetricCard label="Cash" value={`${symbol}${account.cash.toFixed(2)}`} />
        <MetricCard label="Invested" value={`${symbol}${invested.toFixed(2)}`} />
        <MetricCard label="Today P&L" value={`${account.todayPnl >= 0 ? "+" : "-"}${symbol}${Math.abs(account.todayPnl).toFixed(2)}`} valueClass={account.todayPnl >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Total P&L" value={`${account.totalPnl >= 0 ? "+" : "-"}${symbol}${Math.abs(account.totalPnl).toFixed(2)}`} valueClass={account.totalPnl >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Available to withdraw" value={withdrawable == null ? "—" : `€${withdrawable.toFixed(2)}`} sub={withdrawable == null ? "FX normalization required" : env.PROFIT_SWEEP_ENABLED ? "Manual request only" : "Profit sweep disabled"} />
      </section>

      <PerformanceCard title="PAPER PERFORMANCE" summary={paperPerformance} active={account.mode === "paper"} currency={account.mode === "paper" ? symbol : "€"} />
      <PerformanceCard title="LIVE PERFORMANCE" summary={livePerformance} active={account.mode === "live"} currency={account.mode === "live" ? symbol : "€"} />

      <section className="card mt-4 p-4">
        <div className="label">Open positions · {account.mode.toUpperCase()}</div>
        {positions.length ? <div className="mt-3 divide-y divide-white/7">{positions.map(position => (
          <div key={position.symbol} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between"><div className="font-semibold">{position.symbol}</div><div className={`tabular text-sm ${position.unrealizedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{position.unrealizedPnl >= 0 ? "+" : ""}{symbol}{position.unrealizedPnl.toFixed(2)}</div></div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500"><span>{position.quantity.toFixed(4)} sh</span><span>Entry ${position.averageEntry.toFixed(2)}</span><span>Now ${position.currentPrice.toFixed(2)}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs"><span>Stop {position.stopLoss > 0 ? `$${position.stopLoss.toFixed(2)}` : "broker-managed"}</span><span>Target {position.takeProfit > 0 ? `$${position.takeProfit.toFixed(2)}` : "broker-managed"}</span></div>
          </div>
        ))}</div> : <div className="py-8 text-center text-sm text-slate-500">No {account.mode} positions yet.</div>}
      </section>
    </AppShell>
  );
}

function PerformanceCard({ title, summary, active, currency }: { title: string; summary: PerformanceSummary; active: boolean; currency: string }) {
  const curve = summary.equityCurve.length > 1 ? summary.equityCurve : summary.equityCurve.length ? [summary.equityCurve[0], summary.equityCurve[0]] : [];
  return <section className={`card mt-4 p-4 ${active ? "" : "opacity-75"}`}>
    <div className="flex items-end justify-between"><div><div className="label">{title}</div><h2 className="mt-1 text-lg font-semibold">Equity curve</h2></div><span className="text-xs text-slate-500">{active ? "CURRENT MODE" : "SEPARATE"}</span></div>
    {curve.length ? <div className="mt-3 text-emerald-300"><Sparkline values={curve} /></div> : <div className="my-5 text-sm text-slate-600">No stored equity history.</div>}
    <div className="grid grid-cols-2 gap-y-4 border-t border-white/7 pt-4 text-sm">
      <Stat label="Total return" value={formatPercent(summary.totalReturn)} /><Stat label="Win rate" value={formatPercent(summary.winRate)} />
      <Stat label="Profit factor" value={summary.profitFactor == null ? "—" : summary.profitFactor.toFixed(2)} /><Stat label="Max drawdown" value={formatPercent(summary.maxDrawdown)} />
      <Stat label="Expectancy" value={summary.expectancy == null ? "—" : `${currency}${summary.expectancy.toFixed(3)}`} /><Stat label="Trades" value={String(summary.tradeCount)} />
    </div>
  </section>;
}
function formatPercent(value: number | null) { return value == null ? "—" : `${(value * 100).toFixed(2)}%`; }
function Stat({ label, value }: { label: string; value: string }) { return <div><div className="label text-[9px]">{label}</div><div className="tabular mt-1 font-semibold">{value}</div></div>; }
