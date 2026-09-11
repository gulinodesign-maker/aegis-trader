"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, ShieldAlert, ToggleLeft, ToggleRight } from "lucide-react";
import { haptic } from "./haptics";

const controls = [
  ["Risk / trade", "0.5%"],
  ["Daily loss", "2.0%"],
  ["Total exposure", "100%"],
  ["Single position", "35%"],
  ["Open positions", "3"],
  ["Cash reserve", "10%"],
  ["Max spread", "35 bps"],
  ["Quote max age", "15 sec"]
] as const;

export function RiskControls() {
  const [kill, setKill] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/settings/kill-switch", { cache: "no-store" })
      .then(r => r.json())
      .then(data => { if (mounted) setKill(Boolean(data.active)); })
      .catch(() => { if (mounted) setMessage("Unable to verify server Kill Switch state."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function toggle() {
    if (loading) return;
    const next = !kill;
    if (next) { setKill(true); haptic([18, 45, 18]); } // fail-safe UI: show blocked immediately
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/kill-switch", {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "trading-pwa" },
        body: JSON.stringify({ active: next })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Update failed");
      setKill(Boolean(data.active));
      if (!next) haptic(10);
    } catch (error) {
      // Never visually claim trading is enabled after a failed disable request.
      if (!next) setKill(true);
      setMessage(error instanceof Error ? error.message : "Kill Switch update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className={`mt-4 rounded-[22px] border p-4 ${kill ? "border-rose-400/30 bg-rose-400/8" : "border-white/8 bg-white/3"}`}>
        <button className="touch flex w-full items-center justify-between text-left disabled:opacity-70" onClick={toggle} disabled={loading} aria-pressed={kill}>
          <div className="pr-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert size={18} className={kill ? "text-rose-300" : "text-slate-400"} /> Global Kill Switch</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">Stops new orders server-side. Existing positions remain visible for controlled close-out.</p>
          </div>
          {loading ? <LoaderCircle size={26} className="shrink-0 animate-spin text-slate-500" /> : kill ? <ToggleRight size={34} className="shrink-0 text-rose-300" /> : <ToggleLeft size={34} className="shrink-0 text-slate-600" />}
        </button>
        {kill ? <div className="mt-3 rounded-xl bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-200">NEW TRADES BLOCKED</div> : null}
        {message ? <div className="mt-2 text-xs text-amber-300">{message}</div> : null}
      </section>
      <section className="card mt-4 divide-y divide-white/7 overflow-hidden">
        {controls.map(([label, value]) => <div key={label} className="flex items-center justify-between px-4 py-3.5"><span className="text-sm text-slate-300">{label}</span><span className="tabular text-sm font-semibold">{value}</span></div>)}
      </section>
    </>
  );
}
