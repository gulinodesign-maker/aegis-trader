import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { ModeBadges } from "./mode-badges";
import { getEnv } from "../config/env";
import { requirePageAuthorization } from "../security/auth";

export async function AppShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  await requirePageAuthorization();
  const env = getEnv();
  return (
    <div className="min-h-dvh pb-24">
      <header className="safe-top app-width px-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-[.12em] text-slate-500">AEGIS TRADER</p>
            <h1 className="text-[28px] font-semibold tracking-[-.03em]">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          <ModeBadges demo={env.DEMO_MODE} live={env.TRADING_MODE === "live"} />
        </div>
      </header>
      <main className="app-width px-4">{children}</main>
      <BottomNav />
    </div>
  );
}
