import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BrainCircuit, ShieldCheck, TriangleAlert } from "lucide-react";
import { demoCandles, demoSignals } from "@/demo/data";
import { ModeBadges } from "@/components/mode-badges";
import { Sparkline } from "@/components/sparkline";
import { TradeActions } from "@/components/trade-actions";
import { getEnv, riskConfigFromEnv } from "@/config/env";
import { getRuntime } from "@/runtime/factory";
import { generateSignal } from "@/signal/signal-engine";
import { calculatePositionSize } from "@/risk/position-sizing";
import { runBacktestForSymbol } from "@/backtest/service";
import { requirePageAuthorization } from "@/security/auth";
import type { Candle, Signal } from "@/domain/types";

export const dynamic = "force-dynamic";

export default async function OpportunityPage({ params }: { params: Promise<{ symbol: string }> }) {
  await requirePageAuthorization();
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const env = getEnv();
  const runtime = getRuntime();
  let signal: Signal | undefined;
  let candles: Candle[];
  if (env.DEMO_MODE) {
    signal = demoSignals.find(item => item.symbol === symbol);
    candles = signal ? demoCandles(signal.symbol) : [];
  } else {
    candles = await runtime.marketData.getCandles(symbol, "5Min", 200).catch(() => []);
    signal = generateSignal(candles) ?? undefined;
  }
  if (!signal) notFound();

  const [account, quote, backtest] = await Promise.all([
    runtime.broker.getAccount(),
    runtime.marketData.getQuote(signal.symbol),
    runBacktestForSymbol(signal.symbol).catch(() => null)
  ]);
  const risk = riskConfigFromEnv();
  const sizing = calculatePositionSize({
    accountEquity: account.equity, cash: account.cash, entry: signal.entry, stop: signal.stop,
    riskPercent: risk.maxRiskPerTradePercent, minCashReservePercent: risk.minCashReservePercent,
    maxSinglePositionPercent: risk.maxSinglePositionPercent, fxRateToAccountCurrency: runtime.fxRateToAccountCurrency,
    supportsFractional: runtime.broker.capabilities.fractionalShares
  });

  return (
    <div className="min-h-dvh pb-8">
      <header className="safe-top app-width flex items-center justify-between px-4 pb-4">
        <Link href="/" className="touch flex items-center justify-center rounded-xl border border-white/8"><ArrowLeft size={19} /></Link>
        <ModeBadges demo={env.DEMO_MODE} live={env.TRADING_MODE === "live"} />
      </header>
      <main className="app-width px-4">
        <div className="flex items-end justify-between">
          <div><div className="label">Opportunity</div><h1 className="mt-1 text-4xl font-semibold tracking-[-.05em]">{signal.symbol}</h1></div>
          <div className="text-right"><div className="tabular text-2xl font-semibold">${quote.last.toFixed(2)}</div><div className="text-xs text-slate-500">{quote.origin === "DEMO" ? "demo current price" : `${quote.origin.toLowerCase()} quote`}</div></div>
        </div>
        <section className="card mt-4 overflow-hidden p-4">
          <div className="flex justify-between text-xs text-slate-500"><span>5m · {signal.origin.toLowerCase()}</span><span>Signal {signal.score}/100</span></div>
          <div className="mt-2 text-emerald-300"><Sparkline values={candles.slice(-60).map(c => c.close)} /></div>
        </section>
        <section className="mt-3 grid grid-cols-2 gap-2">
          <Box label="Entry" value={`$${signal.entry.toFixed(2)}`} />
          <Box label="Stop" value={`$${signal.stop.toFixed(2)}`} danger />
          <Box label="Target" value={`$${signal.target.toFixed(2)}`} />
          <Box label="Risk / reward" value={`${signal.riskReward.toFixed(2)}×`} />
          <Box label="Position size" value={`${sizing.quantity.toFixed(4)} sh`} />
          <Box label="Max loss" value={`≈ ${account.currency === "EUR" ? "€" : "$"}${sizing.maxLoss.toFixed(2)}`} danger />
          <Box label="AI confidence" value="Run analysis" />
          <Box label="Signal score" value={`${signal.score}/100`} />
        </section>
        <section className="card mt-4 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><BrainCircuit size={17} className="text-indigo-300" /> WHY THIS SIGNAL</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">{signal.reasons.map(reason => <li key={reason}>• {reason}</li>)}</ul>
        </section>
        <section className="card mt-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert size={17} className="text-amber-300" /> WHAT INVALIDATES IT</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">{signal.invalidations.map(reason => <li key={reason}>• {reason}</li>)}</ul>
        </section>
        {backtest ? <section className="card mt-4 p-4">
          <div className="flex items-end justify-between gap-3"><div><div className="label">Backtest snapshot</div><h2 className="mt-1 text-lg font-semibold">Costs + drawdown included</h2></div><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-400">{backtest.origin === "DEMO" ? "DEMO DATA" : backtest.origin}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-y-4 border-t border-white/7 pt-4 text-sm">
            <Stat label="Trades" value={String(backtest.result.tradeCount)} />
            <Stat label="Win rate" value={`${(backtest.result.winRate * 100).toFixed(1)}%`} />
            <Stat label="Expectancy" value={`${backtest.currency === "EUR" ? "€" : "$"}${backtest.result.expectancy.toFixed(3)}`} />
            <Stat label="Profit factor" value={backtest.result.profitFactor == null ? "—" : backtest.result.profitFactor.toFixed(2)} />
            <Stat label="Max drawdown" value={`${(backtest.result.maxDrawdown * 100).toFixed(2)}%`} />
            <Stat label="Sharpe" value={backtest.result.sharpeRatio == null ? "n/s" : backtest.result.sharpeRatio.toFixed(2)} />
            <Stat label="Initial" value={`${backtest.currency === "EUR" ? "€" : "$"}${backtest.result.initialCapital.toFixed(2)}`} />
            <Stat label="Final" value={`${backtest.currency === "EUR" ? "€" : "$"}${backtest.result.finalCapital.toFixed(2)}`} />
            <Stat label="Commissions" value={`${backtest.currency === "EUR" ? "€" : "$"}${backtest.result.commissions.toFixed(2)}`} />
            <Stat label="Slippage" value={`${backtest.currency === "EUR" ? "€" : "$"}${backtest.result.slippage.toFixed(2)}`} />
          </div>
          <p className="mt-4 text-[11px] leading-5 text-slate-500">{backtest.sampleCandles} candles. A backtest can overfit and does not establish that the strategy will be profitable. Win rate is never used alone.</p>
        </section> : null}
        <section className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-3 text-xs leading-5 text-emerald-100/80"><ShieldCheck size={16} className="mb-1" /> The displayed size is deterministic preview sizing. Execution uses a stored Agent proposal and recomputes Risk Engine checks with fresh market data.</section>
        <TradeActions symbol={signal.symbol} mode={env.TRADING_MODE} />
      </main>
    </div>
  );
}

function Box({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="card p-3"><div className="label text-[9px]">{label}</div><div className={`tabular mt-1.5 text-base font-semibold ${danger ? "text-rose-300" : ""}`}>{value}</div></div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="label text-[9px]">{label}</div><div className="tabular mt-1 font-semibold">{value}</div></div>;
}
