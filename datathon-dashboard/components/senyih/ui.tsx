'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { useChartColors } from './chart-theme';
import type { DnaWeights } from '@/lib/engine/pareto';
import { pct1 } from '@/lib/format';

// Shared building blocks. Light-mode classes are the dashboard's original tokens;
// `dark:` variants add the dark theme.

export const GlassCard = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div
    className={`rounded-2xl border border-sky-200/80 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(14,116,144,0.08)] dark:border-sky-800/50 dark:bg-slate-900/55 dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${className}`}
  >
    {children}
  </div>
);

export const CardHeader = ({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) => (
  <div className="flex items-start justify-between gap-3 mb-4">
    <div>
      <h2 className="text-sm font-bold text-sky-950 dark:text-sky-50 leading-tight">{title}</h2>
      {sub && <p className="text-xs text-sky-700/70 dark:text-sky-300/70 mt-0.5">{sub}</p>}
    </div>
    {right}
  </div>
);

const badgeTones = {
  sky: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-500/30',
  amber: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30',
  teal: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/15 dark:text-teal-200 dark:border-teal-500/30',
  rose: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30',
};

export const Badge = ({ children, tone = 'sky' }: { children: ReactNode; tone?: keyof typeof badgeTones }) => (
  <span className={`shrink-0 px-3 py-1 text-[11px] font-bold rounded-full border ${badgeTones[tone]}`}>{children}</span>
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
  id, title, sub, value, note, ring,
}: { id: string; title: string; sub?: string; value: string; note: string; ring: number }) => (
  <GlassCard className="p-5">
    <CardHeader title={title} sub={sub} />
    <div className="flex items-center gap-4">
      <Ring value={ring} id={id} />
      <div>
        <p className="text-2xl font-black tracking-tight text-sky-950 dark:text-sky-50 leading-none">{value}</p>
        <p className="text-xs text-sky-700/70 dark:text-sky-300/70 mt-2">{note}</p>
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
      <CardHeader title="Island DNA" sub={`${island} · hotel-room mix (L1-normalised)`} />
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950" role="img"
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
            <span className="font-black text-sky-950 dark:text-sky-50">{pct1(p.v)}</span>
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
    <div className={`rounded-2xl border p-4 flex gap-3 items-start backdrop-blur-xl ${tones[tone]}`} role="note">
      <Info size={18} className="mt-0.5 shrink-0" />
      <div className="text-sm leading-relaxed">
        {title && <p className="font-black mb-0.5">{title}</p>}
        {children}
      </div>
    </div>
  );
};
