/**
 * Grafico a linee, solo SVG e senza librerie: linee sottili, grigi tenui, griglia a filo
 * e assi con etichette leggibili. Le serie si distinguono per tratto (pieno/tratteggiato) e
 * per l'etichetta in legenda, non per il colore.
 */
export interface ChartSeries {
  name: string;
  values: number[];
  dashed?: boolean;
}

const W = 720;
const H = 288;
const PAD = { top: 16, right: 16, bottom: 40, left: 80 };

/** Estremo «tondo» sopra il massimo, così le tacche dell'asse cadono su numeri leggibili. */
export function niceMax(max: number): number {
  if (max <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return step * exp;
}

export function LineChart({
  labels,
  series,
  formatValue,
  ariaLabel,
}: {
  labels: string[];
  series: ChartSeries[];
  formatValue: (v: number) => string;
  ariaLabel: string;
}) {
  const all = series.flatMap((s) => s.values);
  const min = Math.min(0, ...all);
  const top = niceMax(Math.max(0, ...all));
  const bottom = min < 0 ? -niceMax(-min) : 0;
  const span = top - bottom || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (labels.length === 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - bottom) / span) * innerH;
  const ticks = Array.from({ length: 5 }, (_, i) => bottom + (span / 4) * i);

  return (
    <figure>
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-600">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-2">
            <svg width="24" height="8" aria-hidden>
              <line x1="0" x2="24" y1="4" y2="4" stroke={s.dashed ? "var(--color-stone-500)" : "var(--color-stone-900)"} strokeWidth="1.5" strokeDasharray={s.dashed ? "4 4" : undefined} />
            </svg>
            {s.name}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto min-w-[560px] w-full">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-stone-200)" strokeWidth="1" />
              <text x={PAD.left - 16} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize="13" fill="var(--color-stone-600)">
                {formatValue(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) => (
            <text key={`${l}-${i}`} x={x(i)} y={H - 16} textAnchor="middle" fontSize="13" fill="var(--color-stone-600)">
              {l}
            </text>
          ))}
          {series.map((s) => (
            <polyline
              key={s.name}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={s.dashed ? "var(--color-stone-500)" : "var(--color-stone-900)"}
              strokeWidth="1.5"
              strokeDasharray={s.dashed ? "6 6" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </div>
    </figure>
  );
}
