import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Signal } from "@/domain/types";

export function OpportunityCard({ signal }: { signal: Signal }) {
  const risk = Math.abs(signal.entry - signal.stop);
  const origin = signal.origin === "DEMO" ? "demo quote" : `${signal.origin.toLowerCase()} data`;
  return (
    <article className="card overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{signal.symbol}</span>
            <span className="rounded-md bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">LONG</span>
          </div>
          <div className="tabular mt-1 text-sm text-slate-400">${signal.entry.toFixed(2)} · {origin}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tracking-[-.04em]">{signal.score}</div>
          <div className="label">Signal score</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
        <Mini label="ENTRY" value={`$${signal.entry.toFixed(2)}`} />
        <Mini label="STOP" value={`$${signal.stop.toFixed(2)}`} />
        <Mini label="TARGET" value={`$${signal.target.toFixed(2)}`} />
        <Mini label="R:R" value={`${signal.riskReward.toFixed(1)}×`} />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/7 pt-3">
        <span className="text-xs text-slate-500">Risk/share ${risk.toFixed(2)}</span>
        <Link href={`/opportunity/${signal.symbol}`} className="touch inline-flex items-center gap-1 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black">
          ANALYZE <ArrowUpRight size={14} />
        </Link>
      </div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><div className="label text-[9px]">{label}</div><div className="tabular mt-1 font-semibold text-slate-200">{value}</div></div>;
}
