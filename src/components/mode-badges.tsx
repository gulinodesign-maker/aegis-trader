export function ModeBadges({ demo = true, live = false }: { demo?: boolean; live?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {demo ? <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold tracking-[.08em] text-amber-200">DEMO DATA</span> : null}
      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[.08em] ${live ? "border-rose-300/20 bg-rose-300/10 text-rose-200" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"}`}>
        {live ? "LIVE" : "PAPER"}
      </span>
    </div>
  );
}
