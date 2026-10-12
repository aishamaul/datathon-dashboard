'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { TourismDNA } from '@/lib/data/transferability';
import { MyPulauMark } from './brand';

export type PreviewPoint = { x: number; y: number; kind: 'candidate' | 'frontier' | 'balanced' };

const LANES = [
  { key: 'marine', label: 'Marine', pressure: 'Reef pressure', color: '#22d3ee', y: 70 },
  { key: 'retail', label: 'Retail', pressure: 'Waste pressure', color: '#fbbf24', y: 170 },
  { key: 'eco', label: 'Eco', pressure: 'Terrestrial pressure', color: '#34d399', y: 270 },
] as const;

type Timeline = { cards: number; flowIn: number; flowOut: number; scan: number; pareto: number; lock: number; ready: number; total: number };

// Milliseconds from overlay start; Infinity marks stages that do not exist in a mode.
const TIMELINE: Timeline = { cards: 250, flowIn: 700, flowOut: 1500, scan: 1900, pareto: 3000, lock: 3300, ready: 3550, total: 3950 };
const STAGE_LABELS = ['Loading synthetic data', 'Evaluating pressures', 'Exploring scenarios', 'Generating insights'];

const ease = (x: number) => 1 - (1 - x) ** 3;
const span = (t: number, start: number, duration: number) => Math.min(1, Math.max(0, (t - start) / duration));
const pct = (share: number) => `${(share * 100).toFixed(1)}%`;

function stepAt(t: number, tl: Timeline) {
  return t < tl.flowIn ? 0 : t < tl.scan ? 1 : t < tl.lock ? 2 : 3;
}

function caption(t: number, tl: Timeline) {
  return t < tl.flowIn ? 'Loading synthetic supporting data' : t < tl.scan ? 'Evaluating pressure assumptions' : t < tl.lock ? 'Scanning arrivals × ALOS' : t < tl.ready ? 'Balanced point locked' : 'Illustrative analysis ready';
}

function buildLog(name: string, dna: TourismDNA) {
  return [
    { at: 0, text: `read island profile · ${name} · marine ${pct(dna.marine)} · retail ${pct(dna.retail)} · eco ${pct(dna.eco)}` },
    { at: 0, text: 'load illustrative supporting dataset (synthetic)' },
    { at: 700, text: 'evaluate reef disturbance, waste capacity and terrestrial pressure assumptions' },
    { at: 1900, text: 'scan candidate arrivals × ALOS combinations' },
    { at: 3000, text: 'identify Pareto-efficient scenarios' },
    { at: 3300, text: 'lock balanced illustrative solution' },
    { at: 3550, text: 'prepare illustrative insights' },
  ];
}

type Status = 'waiting' | 'evaluating' | 'mapped' | 'ready';
const STATUS_TEXT: Record<Status, string> = { waiting: 'waiting', evaluating: 'evaluating…', mapped: 'mapped', ready: '✓ ready' };

function pillarStatus(t: number, tl: Timeline, index: number): Status {
  if (t >= tl.ready) return 'ready';
  const start = tl.flowOut + index * 220;
  if (t < start) return 'waiting';
  return t < start + 500 ? 'evaluating' : 'mapped';
}

function starPath(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${i === 0 ? 'M' : 'L'}${(cx + Math.cos(angle) * radius).toFixed(1)} ${(cy + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ') + ' Z';
}

function ScenarioSweep({ t, tl, points }: { t: number; tl: Timeline; points: PreviewPoint[] }) {
  const x0 = 30, x1 = 248, y0 = 188, y1 = 16;
  const px = (v: number) => x0 + 8 + v * (x1 - x0 - 16);
  const py = (v: number) => y0 - 8 - v * (y0 - y1 - 16);
  const candidates = points.filter((p) => p.kind === 'candidate');
  const frontier = points.filter((p) => p.kind === 'frontier').sort((a, b) => a.x - b.x);
  const balanced = points.find((p) => p.kind === 'balanced');
  const showFrame = t >= tl.flowOut;
  const locked = t >= tl.lock;

  return (
    <div className="rounded-2xl border border-sky-200 bg-white/80 p-3 shadow-sm" style={{ opacity: showFrame ? 1 : 0.25, transition: 'opacity 0.6s' }}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Scenario sweep · illustrative trade-off model</p>
      <svg viewBox="0 0 260 210" className="mx-auto mt-1 max-h-[32vh] w-full" role="img" aria-label="Illustrative candidate scenarios forming a trade-off model with a balanced point selected">
        <defs>
          <filter id="sw-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={x0} x2={x1} y1={y0 - g * (y0 - y1)} y2={y0 - g * (y0 - y1)} stroke="#0284c7" strokeOpacity="0.12" />)}
        <line x1={x0} x2={x1} y1={y0} y2={y0} stroke="#0369a1" strokeOpacity="0.35" />
        <line x1={x0} x2={x0} y1={y0} y2={y1} stroke="#0369a1" strokeOpacity="0.35" />
        <text x={(x0 + x1) / 2} y="204" fontSize="8" textAnchor="middle" fill="#0369a1" opacity="0.82">Economic yield (visitor-nights) →</text>
        <text x="9" y={(y0 + y1) / 2} fontSize="8" textAnchor="middle" fill="#0369a1" opacity="0.82" transform={`rotate(-90 9 ${(y0 + y1) / 2})`}>Illustrative EHI →</text>

        {candidates.map((p, i) => t >= tl.scan + (i / Math.max(1, candidates.length)) * 1000 && (
          <circle key={`c${i}`} cx={px(p.x)} cy={py(p.y)} r="2.2" fill="#38bdf8" className="transfer-pop" />
        ))}
        {t >= tl.pareto && frontier.length > 1 && (
          <polyline points={frontier.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ')} fill="none" stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.8" pathLength={1} className="transfer-trace" />
        )}
        {frontier.map((p, i) => t >= tl.pareto + i * 25 && (
          <rect key={`f${i}`} x={px(p.x) - 2.6} y={py(p.y) - 2.6} width="5.2" height="5.2" fill="#34d399" transform={`rotate(45 ${px(p.x)} ${py(p.y)})`} className="transfer-pop" />
        ))}
        {balanced && locked && (
          <g filter="url(#sw-glow)">
            <circle cx={px(balanced.x)} cy={py(balanced.y)} r="9" fill="none" stroke="#fbbf24" strokeWidth="1.5" className="transfer-ripple" />
            <path d={starPath(px(balanced.x), py(balanced.y), 8, 3.4)} fill="#fbbf24" stroke="#fff" strokeWidth="1" className="transfer-pop" />
          </g>
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-sky-800">
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-400" />Candidates</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rotate-45 bg-emerald-400" />Pareto-efficient</span>
        <span className="inline-flex items-center gap-1"><i className="text-amber-300">★</i>Balanced point</span>
      </div>
    </div>
  );
}

export function AnalysisOverlay({ islandName, dna, points, onComplete }: {
  islandName: string;
  dna: TourismDNA;
  points: PreviewPoint[];
  onComplete: () => void;
}) {
  const tl = TIMELINE;
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const speed = reduced ? 2.2 : 1;
  const [t, setT] = useState(0);
  const completeRef = useRef(onComplete);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { completeRef.current = onComplete; });

  useEffect(() => {
    const started = performance.now();
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - started) * speed;
      setT(Math.min(elapsed, tl.total));
      if (elapsed >= tl.total) {
        window.clearInterval(id);
        completeRef.current();
      }
    }, 33);
    return () => window.clearInterval(id);
  }, [speed, tl.total]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    skipRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') completeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, []);

  const step = stepAt(t, tl);
  const ready = t >= tl.ready;
  const leaving = t >= tl.total - 250;
  const labels = STAGE_LABELS;
  const log = buildLog(islandName, dna).filter((line) => t >= line.at).slice(-5);
  const engineOn = t >= tl.cards;

  return (
    <div className={`transfer-overlay fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-sky-950/35 p-4 backdrop-blur-md transition-opacity duration-200 ${leaving ? 'opacity-0' : 'opacity-100'}`} role="dialog" aria-modal="true" aria-label={`Analysing ${islandName}`}>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'radial-gradient(52rem 30rem at 50% 38%, rgba(34,211,238,0.17), transparent 65%), radial-gradient(36rem 22rem at 85% 90%, rgba(251,191,36,0.08), transparent 70%), repeating-linear-gradient(90deg, rgba(2,132,199,0.06) 0 1px, transparent 1px 72px), repeating-linear-gradient(0deg, rgba(2,132,199,0.04) 0 1px, transparent 1px 72px)' }} aria-hidden="true" />
      <div className="transfer-scanline pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent" aria-hidden="true" />

      <div className="transfer-panel relative my-auto w-full max-w-5xl rounded-[2rem] border border-sky-200/90 bg-gradient-to-br from-white/95 via-sky-50/95 to-cyan-50/95 p-5 text-sky-950 shadow-[0_24px_90px_rgba(8,47,73,0.28)] md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-700"><MyPulauMark size="sm" className="normal-case tracking-tight" /><span aria-hidden="true">·</span>Illustrative Workflow</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">{islandName}</h2>
            <span className="mt-2 inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-900">
              Illustrative Simulation — Synthetic Data
            </span>
          </div>
          <button ref={skipRef} type="button" onClick={() => completeRef.current()} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sky-200 bg-white/75 px-3 py-1.5 text-xs font-bold text-sky-800 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            Skip <X size={13} />
          </button>
        </div>

        <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Analysis stages">
          {labels.map((label, i) => {
            const done = i < step || (i === 3 && ready);
            const active = !done && i === step;
            const tone = done ? `border-emerald-400 bg-emerald-50 text-emerald-800 ${i === 3 && ready ? 'shadow-[0_0_24px_rgba(52,211,153,0.28)]' : ''}`
              : active ? 'border-cyan-400 bg-cyan-50 text-cyan-900 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                : 'border-sky-200 bg-white/50 text-sky-400';
            return (
              <li key={label} className={`rounded-xl border px-3 py-2 transition-all duration-500 ${tone}`} aria-current={active ? 'step' : undefined}>
                <span className="flex items-center justify-between text-[9px] font-black tracking-widest opacity-80">
                  0{i + 1}
                  {done ? <Check size={12} /> : active ? <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-cyan-500 opacity-75 motion-safe:animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-600" /></span> : null}
                </span>
                <span className="mt-0.5 block text-[11px] font-bold leading-tight">{label}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 grid items-center gap-4 lg:grid-cols-[1.55fr_1fr]">
          <svg viewBox="0 0 600 340" className="mx-auto max-h-[38vh] w-full" role="img" aria-label="Tourism DNA flowing into the shared framework and out to three environmental pressure pillars">
            <defs>
              <radialGradient id="ov-core">
                <stop offset="0" stopColor={ready ? '#6ee7b7' : '#67e8f9'} />
                <stop offset="1" stopColor={ready ? '#047857' : '#0e7490'} />
              </radialGradient>
              <radialGradient id="ov-sweep" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="66">
                <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
                <stop offset="1" stopColor="#22d3ee" stopOpacity="0.55" />
              </radialGradient>
            </defs>

            {LANES.map((lane, i) => {
              const inPath = `M112 ${lane.y} C 200 ${lane.y}, 210 170, 262 170`;
              const outPath = `M338 170 C 390 170, 400 ${lane.y}, 488 ${lane.y}`;
              const cardP = ease(span(t, tl.cards + i * 180, 450));
              const countP = ease(span(t, tl.cards + i * 180 + 120, 800));
              const inLive = t >= tl.flowIn + i * 220;
              const outLive = t >= tl.flowOut + i * 220;
              const status = pillarStatus(t, tl, i);
              const glow = (on: boolean) => ({ opacity: on ? 1 : 0, transition: 'opacity 0.5s', filter: on ? `drop-shadow(0 0 5px ${lane.color})` : 'none' });
              return (
                <g key={lane.key}>
                  <path d={inPath} stroke={lane.color} strokeOpacity="0.14" strokeWidth="2" fill="none" />
                  <path d={inPath} className="transfer-flow" stroke={lane.color} strokeWidth="3" fill="none" style={glow(inLive)} />
                  <path d={outPath} stroke={lane.color} strokeOpacity={outLive ? 0.18 : 0.06} strokeWidth="2" fill="none" />
                  <path d={outPath} className="transfer-flow" stroke={lane.color} strokeWidth="3" fill="none" style={glow(outLive)} />
                  {!reduced && inLive && !ready && <circle r="4.5" fill={lane.color} style={{ filter: `drop-shadow(0 0 6px ${lane.color})` }}><animateMotion dur="1.3s" repeatCount="indefinite" path={inPath} /></circle>}
                  {!reduced && outLive && !ready && <circle r="4.5" fill={lane.color} style={{ filter: `drop-shadow(0 0 6px ${lane.color})` }}><animateMotion dur="1.3s" repeatCount="indefinite" path={outPath} /></circle>}

                  <g style={{ opacity: cardP, transform: `translateX(${(1 - cardP) * -16}px)` }}>
                    <rect x="8" y={lane.y - 26} width="104" height="52" rx="12" fill="rgba(255,255,255,0.94)" stroke={lane.color} strokeOpacity="0.72" />
                    <text x="20" y={lane.y - 6} fontSize="12" fontWeight="800" fill="#082f49">{lane.label}</text>
                    <text x="100" y={lane.y - 6} fontSize="12" fontWeight="800" fill={lane.color} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>{pct(dna[lane.key] * countP)}</text>
                    <rect x="20" y={lane.y + 8} width="80" height="4" rx="2" fill={lane.color} opacity="0.2" />
                    <rect x="20" y={lane.y + 8} width={Math.max(0, 80 * dna[lane.key] * countP)} height="4" rx="2" fill={lane.color} />
                  </g>

                  <g style={{ opacity: engineOn ? 1 : 0.3, transition: 'opacity 0.6s' }}>
                    <rect x="488" y={lane.y - 26} width="104" height="52" rx="12" fill="rgba(255,255,255,0.94)" stroke={lane.color} strokeOpacity={status === 'waiting' ? 0.22 : 0.8} strokeDasharray={status === 'waiting' ? '4 4' : undefined} style={{ transition: 'stroke-opacity 0.4s', filter: status === 'evaluating' ? `drop-shadow(0 0 8px ${lane.color})` : 'none' }} />
                    <text x="540" y={lane.y - 3} fontSize="11" fontWeight="800" fill="#082f49" textAnchor="middle" opacity={status === 'waiting' ? 0.5 : 1}>{lane.pressure}</text>
                    <text x="540" y={lane.y + 14} fontSize="9" fontWeight="700" textAnchor="middle" fill={status === 'mapped' || status === 'ready' ? '#047857' : lane.color} opacity={status === 'waiting' ? 0.5 : 1}>{STATUS_TEXT[status]}</text>
                  </g>
                </g>
              );
            })}

            <g transform="translate(300 170)" style={{ opacity: engineOn ? 1 : 0.35, transition: 'opacity 0.6s' }}>
              {t >= tl.flowIn && <>
                <circle r="40" fill="none" stroke="#22d3ee" strokeWidth="1.5" className="transfer-ripple" />
                <circle r="40" fill="none" stroke="#22d3ee" strokeWidth="1.5" className="transfer-ripple" style={{ animationDelay: '0.9s' }} />
              </>}
              <circle r="78" fill="none" stroke="#fff" strokeOpacity="0.07" />
              <g className="transfer-spin">
                <circle r="66" fill="none" stroke="#22d3ee" strokeOpacity="0.3" strokeDasharray="4 9" />
                <circle cx="66" cy="0" r="3.5" fill="#22d3ee" style={{ filter: 'drop-shadow(0 0 5px #22d3ee)' }} />
                <circle cx="-33" cy="57.2" r="3.5" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 5px #fbbf24)' }} />
                <circle cx="-33" cy="-57.2" r="3.5" fill="#34d399" style={{ filter: 'drop-shadow(0 0 5px #34d399)' }} />
              </g>
              <g className="transfer-spin-rev">
                <circle r="52" fill="none" stroke="#34d399" strokeOpacity="0.35" strokeDasharray="2 11" />
              </g>
              {!ready && <g className="transfer-spin" style={{ animationDuration: '2.2s' }}>
                <circle r="66" fill="none" />
                <path d="M0 0 L66 0 A66 66 0 0 0 57.2 -33 Z" fill="url(#ov-sweep)" />
              </g>}
              <circle r="36" fill="url(#ov-core)" className="transfer-pulse" style={{ filter: `drop-shadow(0 0 14px ${ready ? '#34d399' : '#22d3ee'})` }} />
              {ready
                ? <path d="M-14 1 l10 10 l20 -22" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" className="transfer-draw" />
                : <><text y="-2" textAnchor="middle" fontSize="8" fontWeight="800" letterSpacing="1.5" fill="#ecfeff">SHARED</text><text y="9" textAnchor="middle" fontSize="8" fontWeight="800" letterSpacing="1.5" fill="#ecfeff">FRAMEWORK</text></>}
            </g>
            <text x="300" y="268" textAnchor="middle" fontSize="10" fontWeight="800" letterSpacing="2" fill="#0e7490">ONE SHARED FRAMEWORK</text>
            <text x="300" y="286" textAnchor="middle" fontSize="10" fontWeight="600" fill="#0369a1" opacity="0.85">{caption(t, tl)}</text>
          </svg>

          <ScenarioSweep t={t} tl={tl} points={points} />
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sky-100" role="progressbar" aria-label="Analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((t / tl.total) * 100)}>
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400" style={{ width: `${(t / tl.total) * 100}%` }} />
        </div>

        <div className="mt-4 min-h-[7.5rem] rounded-xl border border-sky-200 bg-white/80 p-3 font-mono text-[11px] leading-relaxed text-sky-900 shadow-inner">
          {log.map((line, i) => {
            const last = i === log.length - 1;
            const chars = last ? Math.min(line.text.length, Math.floor((t - line.at) / 14)) : line.text.length;
            const typing = chars < line.text.length;
            return (
              <p key={`${line.at}-${line.text}`} className="transfer-line flex items-start gap-2">
                {typing || (last && !ready) ? <span className="text-cyan-400">›</span> : <Check size={12} className="mt-0.5 shrink-0 text-emerald-400" />}
                <span>
                  {line.text.slice(0, chars)}
                  {last && <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-cyan-300 motion-safe:animate-pulse" aria-hidden="true" />}
                </span>
              </p>
            );
          })}
        </div>
        <p className="sr-only" aria-live="polite">{caption(t, tl)}</p>
        <p className="mt-3 text-[11px] font-semibold text-sky-700">Illustrative simulation on synthetic supporting data. Not validated policy output and not the trained Ridge model.</p>
      </div>
    </div>
  );
}
