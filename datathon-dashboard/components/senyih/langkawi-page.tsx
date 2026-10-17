'use client';

import { useEffect, useMemo, useState } from 'react';
import { Expand, Minimize2 } from 'lucide-react';
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Label, LabelList, Legend, Line, LineChart, ReferenceDot,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Analysis } from '@/lib/engine/analysis';
import { SEARCH_BOUNDS, N_SEARCH } from '@/lib/engine/pareto';
import { fmt1, fmt2, fmtInt, pct1, signedPct } from '@/lib/format';
import { useChartColors, useNarrow } from './chart-theme';
import { ArrivalsTrendCard, CatalystCard, CoralChangeCard, EconomicYieldCard, RegressionCard } from './insight-charts';
import { Badge, Callout, CardHeader, DnaTile, GlassCard, StatTile, WaveBackdrop } from './ui';

// PAGE 1: THE MACRO ANCHOR (LANGKAWI). Every number comes from the engine's Current-disturbance scenario.

export function LangkawiPage({ analysis }: { analysis: Analysis }) {
  const c = useChartColors();
  const narrow = useNarrow();
  const [expandedChart, setExpandedChart] = useState<'pareto' | 'quotas' | null>(null);
  const { setup, scenarios } = analysis.islands.Langkawi;
  const s = scenarios.current;
  const { forecast, decoupling, economy, economicYield, catalyst, coralChange, arrivals } = analysis;
  const legendText = (value: string) => <span style={{ color: c.tickX }}>{value}</span>;

  const atAlosCeiling = Math.abs(s.alos / setup.currentAlos - SEARCH_BOUNDS.alosHi) < 0.005;

  const scatterData = useMemo(
    () => s.scatter.filter((p) => !p.knee).map((p) => ({ x: p.yieldK / 1000, y: p.ehi * 100 })),
    [s],
  );
  const knee = useMemo(() => {
    const k = s.scatter.find((p) => p.knee)!;
    return { x: k.yieldK / 1000, y: k.ehi * 100, label: 'Utopia point' };
  }, [s]);

  const quotaData = forecast?.quotas.map((q) => ({
    label: q.label,
    quota: q.quotaK,
    demand: q.demandK,
    band: [q.lowerK, q.upperK] as [number, number],
  }));

  useEffect(() => {
    if (!expandedChart) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedChart(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [expandedChart]);

  const renderParetoChart = (expanded: boolean) => (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={expanded ? { top: 20, right: 36, left: 24, bottom: 36 } : { top: 10, right: 16, left: -6, bottom: 22 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
        <XAxis
          type="number" dataKey="x" name="Yield" domain={['auto', 'auto']}
          tickFormatter={(v: number) => fmt1(v)} axisLine={false} tickLine={false}
          tick={{ fill: c.tickX, fontSize: expanded ? 14 : 12 }}
        >
          <Label value="Economic yield (million visitor-nights)" position="insideBottom" offset={-14} fill={c.tickX} fontSize={expanded ? 14 : 12} />
        </XAxis>
        <YAxis
          type="number" dataKey="y" name="EHI" domain={['auto', 'auto']}
          tickFormatter={(v: number) => `${Math.round(v)}`} axisLine={false} tickLine={false}
          tick={{ fill: c.tickLeft, fontSize: expanded ? 14 : 12 }}
        >
          <Label value="Composite EHI (%)" angle={-90} position="insideLeft" offset={16} fill={c.tickLeft} fontSize={expanded ? 14 : 12} />
        </YAxis>
        <Tooltip
          {...c.tooltip}
          cursor={{ strokeDasharray: '3 3' }}
          formatter={(v, name) => (typeof v === 'number' ? (name === 'Yield' ? `${fmt2(v)} M nights` : `${fmt1(v)}%`) : String(v))}
        />
        <Scatter name="Simulated scenarios" data={scatterData} fill={c.skyBright} fillOpacity={0.35} isAnimationActive={false} />
        <Scatter
          name="Utopia point" data={[knee]} isAnimationActive={false}
          shape={(props) => {
            const { cx, cy } = props;
            if (cx === undefined || cy === undefined) return null;
            const points = Array.from({ length: 10 }, (_, index) => {
              const angle = -Math.PI / 2 + index * Math.PI / 5;
              const radius = index % 2 === 0 ? 16 : 7;
              return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
            }).join(' ');
            return <polygon points={points} transform={`translate(${cx} ${cy})`} fill="#facc15" stroke="#facc15" strokeWidth={0} />;
          }}
        >
          <LabelList dataKey="label" position="left" offset={12} fill={c.tickRight} fontSize={expanded ? 14 : 12} fontWeight="bold" />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );

  const renderQuotaChart = (expanded: boolean) => {
    const gradientPrefix = expanded ? 'lk-quota-expanded' : 'lk-quota';
    return quotaData && forecast ? (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={quotaData} margin={expanded ? { top: 20, right: 14, left: 10, bottom: 34 } : { top: 10, right: 4, left: 4, bottom: 22 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: expanded ? 14 : 12 }} dy={8}>
            <Label value={`Month (${forecast.forecastYear})`} position="insideBottom" offset={-14} fill={c.tickX} fontSize={expanded ? 14 : 12} />
          </XAxis>
          <YAxis yAxisId="left" width={narrow ? 50 : 64} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v)}k`} tick={{ fill: c.tickLeft, fontSize: expanded ? 14 : 12 }}>
            <Label value="Enforced quota (thousand visitors)" angle={-90} position="insideLeft" offset={10} fill={c.tickLeft} fontSize={expanded ? 14 : 12} style={{ textAnchor: 'middle' }} />
          </YAxis>
          <YAxis yAxisId="right" orientation="right" width={narrow ? 50 : 64} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v)}k`} tick={{ fill: c.tickRight, fontSize: expanded ? 14 : 12 }}>
            <Label value="Forecast demand (thousand visitors)" angle={90} position="insideRight" offset={10} fill={c.tickRight} fontSize={expanded ? 14 : 12} style={{ textAnchor: 'middle' }} />
          </YAxis>
          <Tooltip
            {...c.tooltip}
            cursor={{ fill: c.cursorFill }}
            formatter={(v) => (Array.isArray(v) ? `${fmtInt(Number(v[0]))}k – ${fmtInt(Number(v[1]))}k` : `${fmtInt(Number(v))}k`)}
          />
          <Legend iconType="circle" iconSize={9} verticalAlign="top" wrapperStyle={{ paddingBottom: '8px', fontSize: expanded ? 14 : 12 }} formatter={legendText} />
          <defs>
            <linearGradient id={`${gradientPrefix}-bar`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.skyBright} />
              <stop offset="100%" stopColor={c.sky} stopOpacity={0.75} />
            </linearGradient>
            <linearGradient id={`${gradientPrefix}-peak`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.amber} />
              <stop offset="100%" stopColor={c.amber} stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id={`${gradientPrefix}-trough`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.rose} />
              <stop offset="100%" stopColor={c.rose} stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <Area yAxisId="right" dataKey="band" name="Demand 95% band" stroke="none" fill={c.amber} fillOpacity={0.16} isAnimationActive={false} />
          <Bar yAxisId="left" dataKey="quota" name="Enforced quota" fill={`url(#${gradientPrefix}-bar)`} radius={[8, 8, 0, 0]} maxBarSize={expanded ? 48 : 30}>
            {quotaData.map((q) => (
              <Cell
                key={q.label}
                fill={q.label === forecast.peak.label ? `url(#${gradientPrefix}-peak)` : q.label === forecast.trough.label ? `url(#${gradientPrefix}-trough)` : `url(#${gradientPrefix}-bar)`}
              />
            ))}
          </Bar>
          <Line yAxisId="right" type="monotone" dataKey="demand" name="SARIMAX demand" stroke={c.tickRight} strokeWidth={2} strokeDasharray="5 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    ) : null;
  };

  return (
    <div className="space-y-5 text-sky-950 dark:text-sky-50">
      {/* Top banner: DNA & limits */}
      <div className="senyih-stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <DnaTile weights={setup.weights} island="Langkawi" />
        <StatTile
          id="lk-cap" title="Target annual cap" sub="Pareto knee · current disturbance"
          value={`${fmtInt(s.capK)}k`}
          note={`${signedPct(s.capVsPeakPct)} vs ${setup.peakYear} peak (${fmtInt(setup.maxVolK)}k arrivals)`}
          ring={Math.abs(s.capVsPeakPct)}
        />
        <StatTile
          id="lk-alos" title="Target ALOS" sub={`Current ${fmt2(setup.currentAlos)} nights`}
          value={fmt2(s.alos)} unit="nights"
          note={`${signedPct(s.alosVsCurrentPct)} vs current${atAlosCeiling ? ' · at search ceiling' : ''}`}
          ring={Math.abs(s.alosVsCurrentPct)}
        />
        <StatTile
          id="lk-ehi" title="Ecological health" sub="EHI at the recommended point"
          value={pct1(s.ehi)}
          note={`Marine ${pct1(s.hMarine)} · waste limit ${fmtInt(setup.wasteLimitTons)} t`}
          ring={s.ehi * 100}
        />
      </div>

      {/* Demand: tourist arrivals, yearly or by month */}
      <ArrivalsTrendCard arrivals={arrivals} />

      {/* The economic reality: what tourism revenue buys the island */}
      <div className="senyih-stagger grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RegressionCard
          title="Chart 1A · Grassroots impact"
          result={economy.unemployment}
          tone="rose"
          badgeTone="amber"
          xLabel="Tourism receipts (RM million)"
          yLabel="Unemployment rate (%)"
          yName="Unemployment rate"
          yTick={(v) => `${+v.toFixed(2)}%`}
          yTip={(v) => `${fmt1(v)}%`}
          note="Each dot is one year. The line is the ordinary-least-squares fit of the unemployment rate on tourism receipts, and the shaded band is its 95% confidence interval."
          missing="Needs unemployment rates for at least three years that also have tourism receipts (the Langkawi_Socioeconomic_Master sheet in data_new.xlsx)."
        />
        <EconomicYieldCard yieldData={economicYield} />
      </div>

      {/* Policy: did the interventions extend stays? */}
      {catalyst && <CatalystCard catalyst={catalyst} />}

      {/* Sustainability: waste efficiency and reef resilience */}
      <div className="senyih-stagger grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard className="p-6">
          <CardHeader
            title="Sustainability · The decoupling warning"
            sub={decoupling
              ? `Peaked in ${decoupling.peakYear} at RM ${fmtInt(decoupling.peakValue / 1000)}k per tonne of waste; ${decoupling.latestYear} is ${signedPct(decoupling.changeFromPeakPct)} from peak`
              : 'Needs Decoupling_Index_RM_per_Ton in Langkawi_Socioeconomic_Master'}
            right={<Badge tone="teal">SDG 12</Badge>}
          />
          <div className="h-72">
            {decoupling && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={decoupling.points} margin={{ top: 10, right: 16, left: 4, bottom: 22 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: 12 }} dy={8}>
                    <Label value="Year" position="insideBottom" offset={-14} fill={c.tickX} fontSize={12} />
                  </XAxis>
                  <YAxis
                    width={64} domain={['auto', 'auto']} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                    tick={{ fill: c.tickLeft, fontSize: 12 }}
                  >
                    <Label value="Revenue per tonne of waste (RM / t)" angle={-90} position="insideLeft" offset={10} fill={c.tickLeft} fontSize={12} style={{ textAnchor: 'middle' }} />
                  </YAxis>
                  <Tooltip
                    {...c.tooltip}
                    cursor={{ stroke: c.refLine, strokeWidth: 1 }}
                    formatter={(v) => (typeof v === 'number' ? `RM ${fmtInt(v)} / t` : String(v))}
                  />
                  <Line type="monotone" dataKey="value" name="Decoupling index" stroke={c.teal} strokeWidth={3} dot={{ r: 4 }} />
                  <ReferenceDot x={decoupling.peakYear} y={decoupling.peakValue} r={8} fill={c.amber} stroke="#fff" strokeWidth={2}>
                    <Label value={`Peak ${decoupling.peakYear}`} position="top" fill={c.tickRight} fontSize={12} fontWeight="bold" />
                  </ReferenceDot>
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-sky-700/80 dark:text-sky-300/80">
            Revenue earned per tonne of waste. Falling values mean each ringgit now costs more waste.
          </p>
        </GlassCard>

        {coralChange && <CoralChangeCard coral={coralChange} />}
      </div>

      {/* The policy engine output (SDG 9 & 11) */}
      <div className="senyih-stagger grid grid-cols-1 xl:grid-cols-2 gap-5">
        <GlassCard className="p-6 relative overflow-hidden">
          <WaveBackdrop />
          <div className="relative">
            <CardHeader
              title="Chart 2A · The Pareto equilibrium"
              sub={`${fmtInt(N_SEARCH)} stochastic (volume, ALOS) combinations · ${fmtInt(scatterData.length)} plotted · Utopia point: ${fmtInt(s.capK)}k cap, ${fmt2(s.alos)} nights`}
              right={
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="amber">SDG 9</Badge>
                  <button type="button" onClick={() => setExpandedChart('pareto')} aria-label="Expand Pareto equilibrium chart" title="Expand chart" className="grid h-9 w-9 place-items-center rounded-lg border border-sky-200 bg-white/70 text-sky-700 transition hover:border-cyan-400 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-sky-800 dark:bg-slate-900/70 dark:text-sky-200 dark:hover:bg-slate-800">
                    <Expand size={16} />
                  </button>
                </div>
              }
            />
            <div className="h-80">{renderParetoChart(false)}</div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <CardHeader
            title="Chart 2B · Actionable monthly quotas"
            sub={forecast
              ? `${forecast.forecastYear}: ${fmtInt(s.capK)}k cap split by SARIMAX seasonal shape · peak ${forecast.peak.label} ${fmtInt(forecast.peak.quotaK)}k, trough ${forecast.trough.label} ${fmtInt(forecast.trough.quotaK)}k`
              : 'Monthly quotas unavailable'}
            right={
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone="amber">SDG 11</Badge>
                <button type="button" onClick={() => setExpandedChart('quotas')} aria-label="Expand actionable monthly quotas chart" title="Expand chart" className="grid h-9 w-9 place-items-center rounded-lg border border-sky-200 bg-white/70 text-sky-700 transition hover:border-cyan-400 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-sky-800 dark:bg-slate-900/70 dark:text-sky-200 dark:hover:bg-slate-800">
                  <Expand size={16} />
                </button>
              </div>
            }
          />
          {quotaData ? (
            <>
              <div className="h-72">{renderQuotaChart(false)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {forecast!.backtest && (
                  <>
                    <Badge tone="sky">{forecast!.holdoutYear} holdout: SARIMAX MAPE {fmt1(forecast!.backtest.sarimaxMape)}%</Badge>
                    <Badge tone={forecast!.backtest.winner === 'naive' ? 'amber' : 'teal'}>
                      Seasonal-naive MAPE {fmt1(forecast!.backtest.naiveMape)}%
                    </Badge>
                  </>
                )}
                <Badge tone="rose">Trough {forecast!.trough.label}</Badge>
                <Badge tone="amber">Peak {forecast!.peak.label}</Badge>
              </div>
              {forecast!.backtest && (
                <p className="mt-3 text-xs text-sky-700/80 dark:text-sky-300/80">
                  {forecast!.backtest.winner === 'naive'
                    ? `Seasonal-naive beat SARIMAX on the ${forecast!.holdoutYear} holdout, so the forecast is used for the seasonal shape of the quotas, not for the annual level (which is set by the Pareto cap).`
                    : `SARIMAX beat the seasonal-naive benchmark on the ${forecast!.holdoutYear} holdout.`}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{analysis.forecastError}</p>
          )}
        </GlassCard>
      </div>

      {expandedChart && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-sky-950/45 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpandedChart(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="expanded-langkawi-chart-title" className="flex h-[min(92vh,980px)] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-2xl shadow-sky-950/30 sm:p-6 dark:border-sky-800 dark:bg-slate-950/95">
            <header className="flex shrink-0 items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Macro Anchor · Langkawi</p>
                <h2 id="expanded-langkawi-chart-title" className="mt-1 text-2xl font-black text-sky-950 dark:text-white sm:text-3xl">
                  {expandedChart === 'pareto' ? 'The Pareto equilibrium' : 'Actionable monthly quotas'}
                </h2>
                <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
                  {expandedChart === 'pareto'
                    ? `${fmtInt(N_SEARCH)} stochastic scenarios · Utopia point: ${fmtInt(s.capK)}k cap, ${fmt2(s.alos)} nights`
                    : forecast ? `${forecast.forecastYear} · Annual cap ${fmtInt(s.capK)}k visitors` : 'Monthly quotas unavailable'}
                </p>
              </div>
              <button type="button" onClick={() => setExpandedChart(null)} aria-label="Close expanded chart" title="Close expanded chart" autoFocus className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-sky-200 bg-white text-sky-700 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"><Minimize2 size={17} /></button>
            </header>
            <div className="mt-3 min-h-0 flex-1">
              {expandedChart === 'pareto' ? renderParetoChart(true) : renderQuotaChart(true)}
            </div>
          </section>
        </div>
      )}

      {forecast?.telemetry && (
        <GlassCard className="p-5">
          <CardHeader title={`H1 ${forecast.forecastYear} live check`} sub="Recorded arrivals against the forecast corridor" />
          <p className="text-base">
            Recorded <b>{fmtInt(forecast.telemetry.actualK)}k</b> over {forecast.telemetry.months} months vs projected{' '}
            <b>{fmtInt(forecast.telemetry.projectedK)}k</b> (95% corridor {fmtInt(forecast.telemetry.lowerK)}k–{fmtInt(forecast.telemetry.upperK)}k):{' '}
            <b>{forecast.telemetry.inside ? 'inside' : 'outside'}</b> the corridor.
          </p>
        </GlassCard>
      )}

      <Callout title="Scope of the cap">
        Note: The recommended {fmtInt(s.capK)}k arrival cap applies strictly to LADA-recorded arrivals at Langkawi gateways.
        Kedah-state visitor figures are utilized exclusively for macroeconomic indicator alignment.
      </Callout>
    </div>
  );
}
