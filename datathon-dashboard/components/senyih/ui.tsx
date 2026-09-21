'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { useChartColors } from './chart-theme';
import type { DnaWeights } from '@/lib/engine/pareto';
import { pct1 } from '@/lib/format';

// Shared building blocks. Card depth, hover and entrance animation live in globals.css (.senyih-card);
// `dark:` variants add the dark theme.

export const GlassCard = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div
    className={`senyih-card rounded-3xl border border-sky-200/70 bg-white/65 backdrop-blur-xl dark:border-sky-400/15 dark:bg-slate-900/55 ${className}`}
  >
    {children}
  </div>
);

/** "Chart 1A · The yield trap" renders as a small eyebrow above the title. */
export const CardHeader = ({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) => {
  const cut = title.indexOf(' · ');
  const eyebrow = cut > -1 ? title.slice(0, cut) : null;
  const main = cut > -1 ? title.slice(cut + 3) : title;
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-300">{eyebrow}</p>
        )}
        <h3 className="text-[15px] font-bold tracking-tight text-sky-950 dark:text-sky-50 leading-tight">{main}</h3>
        {sub && <p className="text-xs leading-relaxed text-sky-700/75 dark:text-sky-300/70 mt-1">{sub}</p>}
      </div>
      {right}
    </div>
  );
};

const badgeTones = {
  sky: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-500/30',
  amber: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30',
  teal: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/15 dark:text-teal-200 dark:border-teal-500/30',
  rose: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30',
};

export const Badge = ({ children, tone = 'sky' }: { children: ReactNode; tone?: keyof typeof badgeTones }) => (
  <span className={`shrink-0 px-3 py-1 text-[11px] font-bold rounded-full border ${badgeTones[tone]}`}>{children}</span>
);

/** Badge with a pulsing dot, for the live simulator. */
export const LiveBadge = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 motion-safe:animate-ping" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
    </span>
    {children}
  </span>
);

/** Donut ring, like the KPI cards in the reference. */
export const Ring = ({ value, id }: { value: number; id: string }) => {
  const c = useChartColors();
  const r = 30;
  const circ = 2 * Math.PI * r;
  const shown = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <svg width="80" height="80" viewBox="0 0 76 76" className="shrink-0" role="img" aria-label={`${shown}%`}>
      <defs>
        <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.ringFrom} />
          <stop offset="100%" stopColor={c.ringTo} />
        </linearGradient>
      </defs>
      <circle cx="38" cy="38" r={r} fill="none" stroke={c.track} strokeWidth="8" />
      <circle
        cx="38" cy="38" r={r} fill="none"
        stroke={`url(#ring-${id})`} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(shown / 100) * circ} ${circ}`}
        transform="rotate(-90 38 38)"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(14,165,233,0.35))' }}
      />
      <text x="38" y="43" textAnchor="middle" fontSize="14" fontWeight="800" fill={c.ringText}>{shown}%</text>
    </svg>
  );
};

/** Faint wave decoration used behind the main charts. */
export const WaveBackdrop = () => {
  const c = useChartColors();
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-60 pointer-events-none"
      viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden="true"
    >
      <path d="M0 300 C 100 260, 200 340, 300 300 S 500 260, 600 300 S 750 330, 800 290 L800 400 L0 400 Z" fill={c.waveA} />
      <path d="M0 340 C 120 310, 220 370, 340 338 S 540 306, 660 340 S 760 360, 800 336 L800 400 L0 400 Z" fill={c.waveB} opacity="0.7" />
    </svg>
  );
};

/** Banner tile: ring + headline value + note. */
export const StatTile = ({
  id, title, sub, value, unit, note, ring,
}: { id: string; title: string; sub?: string; value: string; unit?: string; note: string; ring: number }) => (
  <GlassCard className="p-5">
    <CardHeader title={title} sub={sub} />
    <div className="flex items-center gap-4">
      <Ring value={ring} id={id} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">
          <span className="text-3xl font-black tracking-tight tabular-nums text-sky-950 dark:text-sky-50">{value}</span>
          {unit && <span className="text-sm font-bold text-sky-600 dark:text-sky-300">{unit}</span>}
        </p>
        <p className="text-xs leading-relaxed text-sky-700/75 dark:text-sky-300/70 mt-2">{note}</p>
      </div>
    </div>
  </GlassCard>
);

/** Banner tile for the tourism DNA: three-part L1-normalised room mix. */
export const DnaTile = ({ weights, island }: { weights: DnaWeights; island: string }) => {
  const parts = [
    { key: 'Marine', v: weights.marine, bar: 'bg-sky-500', dot: 'bg-sky-500' },
    { key: 'Retail', v: weights.retail, bar: 'bg-amber-400', dot: 'bg-amber-400' },
    { key: 'Eco', v: weights.eco, bar: 'bg-teal-500', dot: 'bg-teal-500' },
  ];
  return (
    <GlassCard className="p-5">
      <CardHeader title="Island DNA" sub={`${island} · hotel-room mix`} />
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-sky-100 shadow-inner dark:bg-sky-950" role="img"
        aria-label={parts.map((p) => `${p.key} ${pct1(p.v)}`).join(', ')}>
        {parts.map((p) => (
          <div key={p.key} className={p.bar} style={{ width: `${p.v * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-semibold text-sky-800 dark:text-sky-200">
              <span className={`h-2.5 w-2.5 rounded-full ${p.dot}`} />
              {p.key}
            </span>
            <span className="font-black tabular-nums text-sky-950 dark:text-sky-50">{pct1(p.v)}</span>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
};

export const Callout = ({ title, children, tone = 'amber' }: { title?: string; children: ReactNode; tone?: 'amber' | 'sky' }) => {
  const tones = {
    amber: 'border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
    sky: 'border-sky-200 bg-sky-50/80 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100',
  };
  return (
    <div className={`senyih-fade rounded-3xl border px-5 py-4 flex gap-3 items-start backdrop-blur-xl ${tones[tone]}`} role="note">
      <Info size={18} className="mt-0.5 shrink-0" />
      <div className="text-sm leading-relaxed">
        {title && <p className="font-black mb-0.5">{title}</p>}
        {children}
      </div>
    </div>
  );
};
