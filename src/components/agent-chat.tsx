"use client";

import { FormEvent, useState } from "react";
import { ArrowUp, Bot, LoaderCircle, ShieldCheck } from "lucide-react";
import { haptic } from "./haptics";

const suggestions = ["Cosa sta succedendo sul mercato?", "Qual è l’opportunità migliore adesso?", "Analizza AAPL", "Quanto rischio con questo trade?"];

type Message = { role: "user" | "agent"; text: string; origin?: string };

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([{ role: "agent", text: "Sono l’agente di analisi. Posso usare dati, segnali e portfolio disponibili, ma non posso inviare direttamente ordini al broker.", origin: "SYSTEM" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(text: string) {
    if (!text.trim() || loading) return;
    haptic(9);
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "trading-pwa" },
        body: JSON.stringify({ message: text })
      });
      const data = await response.json() as { ok: boolean; answer?: string; message?: string; dataOrigin?: string };
      const answer = response.ok && data.ok ? data.answer ?? "Structured analysis completed." : data.message ?? "Agent request failed.";
      setMessages(prev => [...prev, { role: "agent", text: answer, origin: data.dataOrigin ?? "ERROR" }]);
    } catch {
      setMessages(prev => [...prev, { role: "agent", text: "Agent endpoint unavailable. No market price was inferred or invented.", origin: "ERROR" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-190px)] flex-col">
      <div className="flex-1 space-y-3 pb-4" aria-live="polite">
        {messages.map((m, i) => (
          <div key={`${m.role}-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === "user" ? "bg-white text-black" : "border border-white/8 bg-white/4 text-slate-200"}`}>
              {m.role === "agent" ? <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.1em] text-emerald-300"><Bot size={13} /> AGENT{m.origin && m.origin !== "SYSTEM" ? ` · ${m.origin === "DEMO" ? "DEMO DATA" : m.origin}` : ""}</div> : null}
              {m.text}
            </div>
          </div>
        ))}
        {loading ? <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-400"><LoaderCircle size={15} className="animate-spin" /> Using available tools…</div></div> : null}
        <div className="flex flex-wrap gap-2 pt-2">{suggestions.map(s => <button key={s} disabled={loading} onClick={() => submit(s)} className="touch rounded-full border border-white/8 bg-white/3 px-3 py-2 text-left text-xs text-slate-300 disabled:opacity-50">{s}</button>)}</div>
      </div>
      <div className="sticky bottom-[76px] border-t border-white/7 bg-[#07090d]/95 py-3 backdrop-blur">
        <div className="mb-2 flex items-center gap-2 text-[10px] text-slate-500"><ShieldCheck size={12} /> Risk Engine remains authoritative.</div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void submit(input); }} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/4 p-2">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask the trading agent…" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-600" />
          <button disabled={loading} aria-label="Send" className="touch flex items-center justify-center rounded-xl bg-white text-black disabled:opacity-50"><ArrowUp size={18} /></button>
        </form>
      </div>
    </div>
  );
}
