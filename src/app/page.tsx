import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { OpportunityCard } from "@/components/opportunity-card";
import { getDashboardSnapshot } from "@/runtime/dashboard";
import { Activity, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { account, signals, origin, marketOpen } = await getDashboardSnapshot();
  const riskToday = account.equity > 0 && account.todayPnl < 0 ? Math.abs(account.todayPnl) / account.equity * 100 : 0;
  return (
    <AppShell title="Today" subtitle={`${account.mode === "paper" ? "Paper" : "Live"} capital · no leverage`}>
      <section className="mt-2 grid grid-cols-2 gap-2">
        <MetricCard label="Capital" value={`${account.currency === "EUR" ? "€" : "$"}${account.equity.toFixed(2)}`} sub="Account equity" />
        <MetricCard label="Today" value={`${account.todayPnl >= 0 ? "+" : "-"}${account.currency === "EUR" ? "€" : "$"}${Math.abs(account.todayPnl).toFixed(2)}`} valueClass={account.todayPnl >= 0 ? "text-emerald-300" : "text-rose-300"} sub={account.equity ? `${(account.todayPnl / account.equity * 100).toFixed(2)}%` : "0.00%"} />
        <MetricCard label="Available" value={`${account.currency === "EUR" ? "€" : "$"}${account.cash.toFixed(2)}`} sub="Reserve enforced at execution" />
        <MetricCard label="Risk today" value={`${riskToday.toFixed(1)}%`} sub="Daily cap 2.0%" />
      </section>

      <section className="card mt-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="label">AI Market Status</div>
            <div className="mt-2 flex items-center gap-2 text-base font-semibold"><Activity size={17} className={marketOpen ? "text-emerald-300" : "text-amber-300"} /> {marketOpen ? "Market open · selective" : "Market closed"}</div>
          </div>
          <div className="rounded-full bg-emerald-300/10 p-2 text-emerald-300"><ShieldCheck size={20} /></div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-400">{origin === "DEMO" ? "Synthetic demo signals are active." : `Signals are built from ${origin} market data.`} No new order can bypass manual confirmation and deterministic risk validation.</p>
      </section>

      <div className="mb-3 mt-6 flex items-end justify-between">
        <div><div className="label">Top opportunities</div><h2 className="mt-1 text-xl font-semibold tracking-[-.02em]">Scanner shortlist</h2></div>
        <span className="text-xs text-slate-500">{signals.length} assets</span>
      </div>
      <section className="space-y-3">
        {signals.length ? signals.map(signal => <OpportunityCard key={signal.id} signal={signal} />) : <div className="card p-6 text-center text-sm text-slate-500">No signal passed the current scanner inputs.</div>}
      </section>
      <p className="my-6 text-center text-[11px] leading-5 text-slate-600">Scores and AI outputs are decision support, not return forecasts. Spread, fees, slippage and drawdown can materially change results.</p>
    </AppShell>
  );
}
