import { AppShell } from "@/components/app-shell";
import { OpportunityCard } from "@/components/opportunity-card";
import { getDashboardSnapshot } from "@/runtime/dashboard";
import { Filter, Radio } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const { signals, origin } = await getDashboardSnapshot();
  return (
    <AppShell title="Scanner" subtitle="Quant signals before AI review">
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {["Score ≥ 70", "Long only", "US equities", "Normal vol"].map(x => <span key={x} className="whitespace-nowrap rounded-full border border-white/8 bg-white/3 px-3 py-2 text-xs text-slate-300">{x}</span>)}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div><div className="label">Last scan</div><div className="mt-1 flex items-center gap-2 text-sm text-slate-300"><Radio size={14} className="text-emerald-300" /> {origin === "DEMO" ? "Demo snapshot · clearly synthetic" : `${origin} provider data`}</div></div>
        <button className="touch rounded-xl border border-white/10 px-3 text-slate-300" aria-label="Scanner filters"><Filter size={18} /></button>
      </div>
      <div className="mt-4 space-y-3">{signals.length ? signals.map(signal => <OpportunityCard key={signal.id} signal={signal} />) : <div className="card p-6 text-center text-sm text-slate-500">No current candidates.</div>}</div>
    </AppShell>
  );
}
