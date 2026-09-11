"use client";

import { useState } from "react";
import { Check, LoaderCircle, ShieldX } from "lucide-react";
import { haptic } from "./haptics";

export function PaperTradeButton({ proposalId, mode = "paper" }: { proposalId: string; mode?: "paper" | "live" }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "rejected">("idle");
  const [message, setMessage] = useState("");

  async function execute() {
    if (state === "loading" || state === "done") return;
    setState("loading");
    haptic(8);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "trading-pwa" },
        body: JSON.stringify({ proposalId })
      });
      const body = await res.json() as { ok: boolean; message: string };
      setState(body.ok ? "done" : "rejected");
      setMessage(body.message);
      haptic(body.ok ? [10, 30, 10] : [30, 50, 30]);
    } catch {
      setState("rejected");
      setMessage("Order request unavailable. Reconcile broker/order state before another attempt.");
    }
  }

  const live = mode === "live";
  return (
    <div>
      <button disabled={state === "loading" || state === "done"} onClick={execute} className={`touch flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold disabled:opacity-60 ${live ? "bg-rose-300 text-rose-950" : "bg-white text-black"}`}>
        {state === "loading" ? <LoaderCircle className="animate-spin" size={18} /> : state === "done" ? <Check size={18} /> : state === "rejected" ? <ShieldX size={18} /> : null}
        {state === "done" ? `${live ? "LIVE" : "PAPER"} ORDER ACCEPTED` : `EXECUTE ${live ? "LIVE" : "PAPER"} TRADE`}
      </button>
      {message ? <p className={`mt-2 text-center text-xs ${state === "done" ? "text-emerald-300" : "text-rose-300"}`}>{message}</p> : null}
    </div>
  );
}
