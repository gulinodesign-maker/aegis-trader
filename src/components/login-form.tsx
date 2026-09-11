"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "trading-pwa" },
        body: JSON.stringify({ code })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Login failed");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card mt-8 p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6"><LockKeyhole size={20} /></div>
      <label className="label" htmlFor="access-code">Access code</label>
      <input id="access-code" type="password" autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base outline-none focus:border-white/30" />
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      <button disabled={busy || !code} className="touch mt-4 w-full rounded-xl bg-white px-4 text-sm font-bold text-black disabled:opacity-40">{busy ? "Signing in…" : "Unlock"}</button>
    </form>
  );
}
