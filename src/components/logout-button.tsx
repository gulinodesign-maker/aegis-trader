"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button disabled={busy} onClick={async () => {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", headers: { "x-requested-with": "trading-pwa" } }).catch(() => undefined);
    router.replace("/login"); router.refresh();
  }} className="touch w-full rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300 disabled:opacity-50">{busy ? "Signing out…" : "Sign out"}</button>;
}
