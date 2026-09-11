import { AppShell } from "@/components/app-shell";
import { RiskControls } from "@/components/risk-controls";

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Safety defaults are conservative">
      <section className="card mt-2 p-4">
        <div className="label">Execution</div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <div className="rounded-xl bg-white px-3 py-3 text-black">MANUAL</div>
          <div className="rounded-xl border border-white/8 px-3 py-3 text-slate-600">ASSISTED</div>
          <div className="rounded-xl border border-white/8 px-3 py-3 text-slate-600">AUTO</div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">V1 defaults to MANUAL. AUTO architecture exists but never bypasses deterministic risk checks.</p>
      </section>
      <RiskControls />
      <section className="card mt-4 p-4">
        <div className="label">Funding</div>
        <div className="mt-2 text-sm font-semibold">Manual SEPA · enabled</div>
        <p className="mt-2 text-xs leading-5 text-slate-500">Revolut personal automation is disabled. Revolut Business integration is feature-flagged and requires official API credentials.</p>
      </section>
      <section className="card mt-4 p-4">
        <div className="label">Profit sweep</div>
        <div className="mt-2 text-sm font-semibold">Off</div>
        <p className="mt-2 text-xs leading-5 text-slate-500">The app can calculate “Available to withdraw”, but V1 never initiates an automatic bank transfer.</p>
      </section>
    </AppShell>
  );
}
