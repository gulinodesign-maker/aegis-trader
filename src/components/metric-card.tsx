export function MetricCard({ label, value, sub, valueClass = "text-white" }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="card min-w-0 p-4">
      <div className="label">{label}</div>
      <div className={`tabular mt-2 truncate text-xl font-semibold tracking-[-.03em] ${valueClass}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}
