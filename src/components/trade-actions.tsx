"use client";

import { useState } from "react";
import { Bot, LoaderCircle, ShieldCheck, ShieldX } from "lucide-react";
import { PaperTradeButton } from "./paper-trade-button";
import { haptic } from "./haptics";

type Proposal = {
  id: string; symbol: string; action: "BUY" | "WAIT" | "CLOSE"; confidence: number;
  entry: number; stopLoss: number; takeProfit: number; riskReward: number; thesis: string; invalidation: string;
};
type Risk = { approved: boolean; reasons: string[]; quantity: number; maxLoss: number; riskCapital: number };

export function TradeActions({ symbol, mode }: { symbol: string; mode: "paper" | "live" }) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [busy, setBusy] = useState<"analyze" | "simulate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (proposal) return proposal;
    setBusy("analyze"); setError(null);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "trading-pwa" },
        body: JSON.stringify({ message: `Analizza ${symbol}. Usa i tool disponibili e restituisci una proposta operativa strutturata; se i dati non sono sufficienti scegli WAIT.` })
      });
      const data = await response.json() as { ok: boolean; proposal?: Proposal; message?: string };
      if (!response.ok || !data.ok || !data.proposal) throw new Error(data.message ?? "Agent analysis failed");
      if (data.proposal.symbol !== symbol) throw new Error("Agent returned a different symbol");
      setProposal(data.proposal); haptic(10); return data.proposal;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent analysis failed");
      return null;
    } finally { setBusy(null); }
  }

  async function simulate() {
    setBusy("simulate"); setError(null);
    try {
      const current = proposal ?? await analyze();
      if (!current) return;
      const response = await fetch("/api/orders/simulate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "trading-pwa" },
        body: JSON.stringify({ proposalId: current.id })
      });
      const data = await response.json() as { ok: boolean; risk?: Risk; message?: string };
      if (!response.ok || !data.ok || !data.risk) throw new Error(data.message ?? "Simulation failed");
      setRisk(data.risk); haptic(data.risk.approved ? 10 : [20, 35, 20]);
    } catch (e) { setError(e instanceof Error ? e.message : "Simulation failed"); }
    finally { setBusy(null); }
  }

  return (
    <section className="mt-4">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => void simulate()} disabled={busy !== null} className="touch rounded-2xl border border-white/10 text-sm font-semibold disabled:opacity-50">{busy === "simulate" ? <LoaderCircle size={17} className="mx-auto animate-spin" /> : "SIMULATE"}</button>
        <button onClick={() => void analyze()} disabled={busy !== null || Boolean(proposal)} className="touch rounded-2xl border border-white/10 text-sm font-semibold disabled:opacity-50">{busy === "analyze" ? <LoaderCircle size={17} className="mx-auto animate-spin" /> : proposal ? "ORDER PREPARED" : "PREPARE ORDER"}</button>
      </div>

      {proposal ? (
        <div className="card mt-3 p-4">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold"><Bot size={16} className="text-indigo-300" /> Agent proposal</div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${proposal.action === "BUY" ? "bg-emerald-300/10 text-emerald-300" : "bg-amber-300/10 text-amber-300"}`}>{proposal.action}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Mini label="Confidence" value={`${proposal.confidence.toFixed(0)}/100`} /><Mini label="R:R" value={`${proposal.riskReward.toFixed(2)}×`} /><Mini label="Stop" value={`$${proposal.stopLoss.toFixed(2)}`} /><Mini label="Target" value={`$${proposal.takeProfit.toFixed(2)}`} /></div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{proposal.thesis}</p>
        </div>
      ) : null}

      {risk ? (
        <div className={`mt-3 rounded-2xl border p-3 text-xs ${risk.approved ? "border-emerald-300/15 bg-emerald-300/5 text-emerald-100" : "border-rose-300/15 bg-rose-300/5 text-rose-100"}`}>
          <div className="flex items-center gap-2 font-semibold">{risk.approved ? <ShieldCheck size={15} /> : <ShieldX size={15} />} Risk Engine: {risk.approved ? "simulation approved" : "rejected"}</div>
          <div className="mt-2">Quantity {risk.quantity.toFixed(6)} · max loss {risk.maxLoss.toFixed(2)} account currency</div>
          {risk.reasons.length ? <div className="mt-1">{risk.reasons.join(" · ")}</div> : null}
        </div>
      ) : null}

      {proposal?.action === "BUY" ? <div className="mt-3"><PaperTradeButton proposalId={proposal.id} mode={mode} /></div> : null}
      {proposal && proposal.action !== "BUY" ? <p className="mt-3 text-center text-xs text-amber-300">No execution button is shown because the Agent proposal is {proposal.action}.</p> : null}
      {error ? <p className="mt-3 text-center text-xs text-rose-300">{error}</p> : null}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) { return <div><div className="label text-[9px]">{label}</div><div className="tabular mt-1 font-semibold">{value}</div></div>; }
