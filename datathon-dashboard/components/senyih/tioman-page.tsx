'use client';

import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Label, Legend, Line, ReferenceLine,
  ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Analysis } from '@/lib/engine/analysis';
import { predictLcc } from '@/lib/engine/marine';
import { SCENARIOS, SEARCH_BOUNDS, N_SEARCH, runScenario, type ScenarioKey } from '@/lib/engine/pareto';
import { fmt1, fmt2, fmtInt, pct1, signedPct } from '@/lib/format';
import { useChartColors, useNarrow } from './chart-theme';
import { Badge, Callout, CardHeader, DnaTile, GlassCard, LiveBadge, StatTile } from './ui';

// PAGE 2: THE MICRO STRESS-TEST (TIOMAN) + POLICY SIMULATOR.
// Moving the management slider re-runs the full 50,000-scenario Pareto search from ml8.py.

export function TiomanPage({ analysis }: { analysis: Analysis }) {
  const c = useChartColors();
  const narrow = useNarrow();
  const legendText = (value: string) => <span style={{ color: c.tickX }}>{value}</span>;
  const { marine } = analysis;
  const { setup, scenarios } = analysis.islands.Tioman;
  const [levelIdx, setLevelIdx] = useState(1); // start on "Current"
  const level: ScenarioKey = SCENARIOS[levelIdx].key;

  // Real re-run of the search each time the level changes
  const result = useMemo(() => runScenario(setup, marine, level), [setup, marine, level]);
  const current = scenarios.current;

  const atAlosCeiling = Math.abs(result.alos / setup.currentAlos - SEARCH_BOUNDS.alosHi) < 0.005;
  const ehiDeltaPts = (result.ehi - current.ehi) * 100;

  // ---- Chart 3 data: coral cover vs disturbance, one fixed-effect line per island
  const proxyShort = setup.proxyReef.replace(/^Pulau\s+/i, '');
  const chart = useMemo(() => {
    const palette = [c.skyBright, c.teal, c.amber, c.rose];
    const ds = marine.rows.map((r) => r.disturbance * 100);
    const xMin = Math.min(...ds);
    const xMax = Math.max(...ds);
    return marine.allIslands.map((island, i) => ({
      island,
      short: island.replace(/^Pulau\s+/i, ''),
      isProxy: island === setup.proxyReef,
      color: palette[i % palette.length],
      points: marine.rows.filter((r) => r.island === island).map((r) => ({ x: r.disturbance * 100, y: r.lcc * 100 })),
      line: [xMin, xMax].map((x) => ({ x, y: predictLcc(marine, x / 100, island) * 100 })),
    }));
  }, [marine, setup.proxyReef, c]);

  const compare = SCENARIOS.map((s) => ({ name: s.short, key: s.key, ehi: scenarios[s.key].ehi * 100 }));

  return (
    <div className="space-y-5 text-sky-950 dark:text-sky-50">
      {/* Top banner (reflects the selected management level) */}
      <div className="senyih-stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <DnaTile weights={setup.weights} island="Tioman" />
        <StatTile
          id="tm-cap" title="Recommended cap" sub={`${result.short} management · Pareto knee`}
          value={`${fmtInt(result.capK)}k`} unit="visitors"
          note={`${signedPct(result.capVsPeakPct)} vs ${setup.peakYear} peak (${fmtInt(setup.maxVolK)}k)`}
          ring={Math.abs(result.capVsPeakPct)}
        />
        <StatTile
          id="tm-alos" title="Target ALOS" sub={`Current ${fmt2(setup.currentAlos)} nights`}
          value={fmt2(result.alos)} unit="nights"
          note={`${signedPct(result.alosVsCurrentPct)} vs current${atAlosCeiling ? ' · at search ceiling' : ''}`}
          ring={Math.abs(result.alosVsCurrentPct)}
        />
        <StatTile
          id="tm-ehi" title="Ecological health" sub="EHI at the recommended point"
          value={pct1(result.ehi)}
          note={`Marine ${pct1(result.hMarine)} · waste limit ${fmtInt(setup.wasteLimitTons)} t`}
          ring={result.ehi * 100}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Center panel: the ecological proof */}
        <div className="xl:col-span-7 space-y-5">
          <GlassCard className="p-6">
            <CardHeader
              title="Chart 3 · The disturbance regression"
              sub={`Pooled Ridge: live coral cover ~ disturbance + island fixed effects · ${marine.rows.length} island-year surveys · α = ${marine.alpha}`}
              right={<Badge tone="teal">SDG 14</Badge>}
            />
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 10, right: 16, left: -6, bottom: 22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                  <XAxis
                    type="number" dataKey="x" domain={[0, 'auto']} tickFormatter={(v: number) => `${Math.round(v)}%`}
                    axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: 12 }}
                  >
                    <Label value="Disturbance indicators (% of survey)" position="insideBottom" offset={-14} fill={c.tickX} fontSize={12} />
                  </XAxis>
                  <YAxis
                    type="number" dataKey="y" domain={['auto', 'auto']} tickFormatter={(v: number) => `${Math.round(v)}%`}
                    axisLine={false} tickLine={false} tick={{ fill: c.tickLeft, fontSize: 12 }}
                  >
                    <Label value="Live coral cover (%)" angle={-90} position="insideLeft" offset={16} fill={c.tickLeft} fontSize={12} />
                  </YAxis>
                  <Tooltip
                    {...c.tooltip}
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(v) => (typeof v === 'number' ? `${fmt1(v)}%` : String(v))}
                  />
                  <Legend iconType="circle" iconSize={9} verticalAlign="top" wrapperStyle={{ paddingBottom: '8px', fontSize: 12 }} formatter={legendText} />
                  {SCENARIOS.map((s) => {
                    const x = scenarios[s.key].disturbance * 100;
                    const active = s.key === level;
                    return (
                      <ReferenceLine
                        key={s.key} x={x} stroke={active ? c.amber : c.muted} strokeWidth={active ? 2 : 1}
                        strokeDasharray={active ? undefined : '4 4'}
                      >
                        {(!narrow || active) && (
                          <Label value={s.short} position="insideTopRight" fill={active ? c.tickRight : c.muted} fontSize={11} fontWeight="bold" />
                        )}
                      </ReferenceLine>
                    );
                  })}
                  {chart.map((s) => (
                    <Line
                      key={`l-${s.island}`} data={s.line} dataKey="y" name={`${s.short} fit`} legendType="none"
                      stroke={s.color} strokeWidth={s.isProxy ? 3 : 1.5} strokeOpacity={s.isProxy ? 1 : 0.55}
                      dot={false} activeDot={false} isAnimationActive={false}
                    />
                  ))}
                  {chart.map((s) => (
                    <Scatter
                      key={`s-${s.island}`} data={s.points} name={s.isProxy ? `${s.short} (proxy reef)` : s.short}
                      fill={s.color} fillOpacity={s.isProxy ? 1 : 0.7} isAnimationActive={false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-sky-700/80 dark:text-sky-300/80">
              Points are surveys; lines are the model&apos;s fit for each reef (same slope, island-specific intercept). Vertical markers show the
              three disturbance scenarios applied to {proxyShort} ({pct1(scenarios.optimal.disturbance)}, {pct1(scenarios.current.disturbance)}, {pct1(scenarios.crisis.disturbance)}).
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <CardHeader title="EHI by management level" sub="Same search, three disturbance scenarios" />
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compare} margin={{ top: 10, right: 16, left: 4, bottom: 22 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: 12 }} dy={6}>
                    <Label value="Disturbance management level" position="insideBottom" offset={-14} fill={c.tickX} fontSize={12} />
                  </XAxis>
                  <YAxis width={64} domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} tick={{ fill: c.tickLeft, fontSize: 12 }}>
                    <Label value="Composite EHI (%)" angle={-90} position="insideLeft" offset={10} fill={c.tickLeft} fontSize={12} style={{ textAnchor: 'middle' }} />
                  </YAxis>
                  <Tooltip {...c.tooltip} cursor={{ fill: c.cursorFill }} formatter={(v) => `${fmt1(Number(v))}%`} />
                  <defs>
                    <linearGradient id="tm-ehi-bar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.skyBright} />
                      <stop offset="100%" stopColor={c.sky} stopOpacity={0.75} />
                    </linearGradient>
                    <linearGradient id="tm-ehi-active" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.amber} />
                      <stop offset="100%" stopColor={c.amber} stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="ehi" name="EHI" fill="url(#tm-ehi-bar)" radius={[8, 8, 0, 0]} barSize={36}>
                    {compare.map((d) => (
                      <Cell
                        key={d.key}
                        fill={d.key === level ? 'url(#tm-ehi-active)' : 'url(#tm-ehi-bar)'}
                        fillOpacity={d.key === level ? 1 : 0.55}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Right panel: the ML simulator */}
        <div className="xl:col-span-5 space-y-5">
          <GlassCard className="p-6">
            <CardHeader
              title="Disturbance management simulator"
              sub={`Re-runs the ${fmtInt(N_SEARCH)}-scenario Pareto search on every change`}
              right={<LiveBadge>Live</LiveBadge>}
            />

            <label htmlFor="mgmt-level" className="text-xs font-bold text-sky-800 dark:text-sky-200">
              Disturbance management level
            </label>
            <input
              id="mgmt-level" type="range" min={0} max={SCENARIOS.length - 1} step={1} value={levelIdx}
              onChange={(e) => setLevelIdx(Number(e.target.value))}
              aria-valuetext={SCENARIOS[levelIdx].label}
              className="senyih-range mt-3 w-full cursor-pointer"
              style={{ ['--fill' as string]: `${(levelIdx / (SCENARIOS.length - 1)) * 100}%` }}
            />
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SCENARIOS.map((s, i) => (
                <button
                  key={s.key} type="button" onClick={() => setLevelIdx(i)} aria-pressed={i === levelIdx}
                  className={`rounded-xl border px-2 py-2 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                    i === levelIdx
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-transparent shadow-md shadow-sky-500/30'
                      : 'bg-white/70 text-sky-700 border-sky-200 hover:bg-white dark:bg-slate-800/60 dark:text-sky-200 dark:border-sky-800/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="block text-xs font-black">{s.short}</span>
                  <span className="block text-[11px] opacity-80">{pct1(scenarios[s.key].disturbance)} disturbed</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-sky-700/80 dark:text-sky-300/80">{result.label}</p>

            <div className="relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-700 text-white p-6 shadow-lg shadow-sky-700/25 ring-1 ring-inset ring-white/15">
              <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" aria-hidden="true" />
              <p className="relative text-xs font-bold text-sky-100">Composite EHI ceiling</p>
              <p className="relative text-5xl font-black tracking-tight tabular-nums mt-1">{pct1(result.ehi)}</p>
              <p className="relative text-xs text-sky-100 mt-2">
                {level === 'current'
                  ? 'Baseline for comparison'
                  : `${ehiDeltaPts > 0 ? '+' : '−'}${Math.abs(ehiDeltaPts).toFixed(1)} pts vs current management`}
                {' · '}predicted live coral {pct1(result.predictedLcc)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200 p-4 dark:from-amber-500/20 dark:to-amber-500/5 dark:border-amber-500/30">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-200">Visitor cap</p>
                <p className="text-2xl font-black text-amber-900 dark:text-amber-100">{fmtInt(result.capK)}k</p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-200/80">{signedPct(result.capVsPeakPct)} vs peak</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200 p-4 dark:from-amber-500/20 dark:to-amber-500/5 dark:border-amber-500/30">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-200">Target ALOS</p>
                <p className="text-2xl font-black text-amber-900 dark:text-amber-100">{fmt2(result.alos)}</p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-200/80">nights per stay</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-white/70 p-4 dark:border-sky-800/60 dark:bg-slate-800/50">
                <p className="text-xs font-bold text-sky-700 dark:text-sky-300">Best EHI in search</p>
                <p className="text-2xl font-black">{pct1(result.ehiMax)}</p>
                <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80">any volume / ALOS tried</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-white/70 p-4 dark:border-sky-800/60 dark:bg-slate-800/50">
                <p className="text-xs font-bold text-sky-700 dark:text-sky-300">Arrival headroom</p>
                <p className="text-2xl font-black">
                  {result.sustainableCeilingK === null ? 'None' : `${fmtInt(result.sustainableCeilingK)}k`}
                </p>
                <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80">max arrivals at today&apos;s EHI</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <Callout tone="sky" title="What the regression shows">
        Disturbance explains {fmt1(marine.r2 * 100)}% of variance in live coral cover (coefficient {marine.disturbanceCoef.toFixed(2)} per unit of
        disturbance). Model LOO MAE is {marine.looMae.toFixed(3)} vs baseline {marine.baselineMae.toFixed(3)} ({fmt1(marine.skillPct)}% skill
        better than baseline). Visitors operate through disturbance, not directly.
      </Callout>
    </div>
  );
}
