export function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.0001);
  const points = values.map((value, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${36 - ((value - min) / range) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" className="h-28 w-full overflow-visible" role="img" aria-label="Demo price chart">
      <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".18" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <polyline points={`0,40 ${points} 100,40`} fill="url(#fade)" stroke="none" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
