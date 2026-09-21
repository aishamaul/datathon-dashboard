'use client';

import { useMemo } from 'react';
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Label, Legend, Line, LineChart, ReferenceDot,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Analysis } from '@/lib/engine/analysis';
import { SEARCH_BOUNDS, N_SEARCH } from '@/lib/engine/pareto';
import { fmt1, fmt2, fmtInt, pct1, signedPct } from '@/lib/format';
import { useChartColors } from './chart-theme';
import { Badge, Callout, CardHeader, DnaTile, GlassCard, StatTile, WaveBackdrop } from './ui';

// PAGE 1: THE MACRO ANCHOR (LANGKAWI). Every number comes from the engine's Current-disturbance scenario.

export function LangkawiPage({ analysis }: { analysis: Analysis }) {
  const c = useChartColors();
  const { setup, scenarios } = analysis.islands.Langkawi;
  const s = scenarios.current;
  const { forecast, yieldTrap, decoupling } = analysis;
  const legendText = (value: string) => <span style={{ color: c.tickX }}>{value}</span>;

  const atAlosCeiling = Math.abs(s.alos / setup.currentAlos - SEARCH_BOUNDS.alosHi) < 0.005;

  const scatterData = useMemo(
    () => s.scatter.filter((p) => !p.knee).map((p) => ({ x: p.yieldK / 1000, y: p.ehi * 100 })),
    [s],
  );
  const knee = useMemo(() => {
    const k = s.scatter.find((p) => p.knee)!;
    return { x: k.yieldK / 1000, y: k.ehi * 100 };
  }, [s]);

  const quotaData = forecast?.quotas.map((q) => ({
    label: q.label,
    quota: q.quotaK,
    demand: q.demandK,
    band: [q.lowerK, q.upperK] as [number, number],
  }));

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

      {/* Top row: the economic reality (SDG 8 & 12) */}
      <div className="senyih-stagger grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard className="p-6">
          <CardHeader
            title="Chart 1A · The yield trap"
            sub={yieldTrap
              ? `${yieldTrap.points[0].year}–${yieldTrap.points[yieldTrap.points.length - 1].year}: ALOS ${signedPct(yieldTrap.alosChangePct)} while yield per night ${signedPct(yieldTrap.yieldChangePct)}`
              : 'Needs ALOS and receipts per trip in Langkawi_Socioeconomic_Master'}
            right={<Badge tone="sky">SDG 8</Badge>}
          />
          <div className="h-72">
            {yieldTrap && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yieldTrap.points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: 12 }} dy={8} />
                  <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: c.tickLeft, fontSize: 12 }} />
                  <Tooltip
                    {...c.tooltip}
                    cursor={{ stroke: c.refLine, strokeWidth: 1 }}
                    formatter={(v) => (typeof v === 'number' ? fmt1(v) : String(v))}
                  />
                  <Legend iconType="circle" iconSize={9} wrapperStyle={{ paddingTop: '12px', fontSize: 12 }} formatter={legendText} />
                  <ReferenceLine y={100} stroke={c.muted} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="alosIndex" name="ALOS (first year = 100)" stroke={c.sky} strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="yieldIndex" name="Yield per night (first year = 100)" stroke={c.amber} strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-3 text-xs text-sky-700/80 dark:text-sky-300/80">
            Yield per night = average receipts per trip ÷ ALOS. Longer stays that don&apos;t raise spend quality add nights, not value.
          </p>
        </GlassCard>

        <GlassCard className="p-6">
          <CardHeader
            title="Chart 1B · The decoupling warning"
            sub={decoupling
              ? `Peaked in ${decoupling.peakYear} at RM ${fmtInt(decoupling.peakValue / 1000)}k per tonne of waste; ${decoupling.latestYear} is ${signedPct(decoupling.changeFromPeakPct)} from peak`
              : 'Needs Decoupling_Index_RM_per_Ton in Langkawi_Socioeconomic_Master'}
            right={<Badge tone="teal">SDG 12</Badge>}
          />
          <div className="h-72">
            {decoupling && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={decoupling.points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: 12 }} dy={8} />
                  <YAxis
                    domain={['auto', 'auto']} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                    tick={{ fill: c.tickLeft, fontSize: 12 }}
                  />
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
          <p className="mt-3 text-xs text-sky-700/80 dark:text-sky-300/80">
            Revenue earned per tonne of waste. Falling values mean each ringgit now costs more waste.
          </p>
        </GlassCard>
      </div>

      {/* Bottom row: the policy engine output (SDG 9 & 11) */}
      <div className="senyih-stagger grid grid-cols-1 xl:grid-cols-2 gap-5">
        <GlassCard className="p-6 relative overflow-hidden">
          <WaveBackdrop />
          <div className="relative">
            <CardHeader
              title="Chart 2A · The Pareto equilibrium"
              sub={`${fmtInt(N_SEARCH)} stochastic (volume, ALOS) combinations · ${fmtInt(scatterData.length)} plotted · Utopia point: ${fmtInt(s.capK)}k cap, ${fmt2(s.alos)} nights`}
              right={<Badge tone="amber">SDG 9</Badge>}
            />
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 16, left: -6, bottom: 22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                  <XAxis
                    type="number" dataKey="x" name="Yield" domain={['auto', 'auto']}
                    tickFormatter={(v: number) => fmt1(v)} axisLine={false} tickLine={false}
                    tick={{ fill: c.tickX, fontSize: 12 }}
                  >
                    <Label value="Economic yield (million visitor-nights)" position="insideBottom" offset={-14} fill={c.tickX} fontSize={12} />
                  </XAxis>
                  <YAxis
                    type="number" dataKey="y" name="EHI" unit="%" domain={['auto', 'auto']}
                    tickFormatter={(v: number) => `${Math.round(v)}`} axisLine={false} tickLine={false}
                    tick={{ fill: c.tickLeft, fontSize: 12 }}
                  >
                    <Label value="Composite EHI (%)" angle={-90} position="insideLeft" offset={16} fill={c.tickLeft} fontSize={12} />
                  </YAxis>
                  <Tooltip
                    {...c.tooltip}
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(v, name) => (typeof v === 'number' ? (name === 'Yield' ? `${fmt2(v)} M nights` : `${fmt1(v)}%`) : String(v))}
                  />
                  <Scatter name="Simulated scenarios" data={scatterData} fill={c.skyBright} fillOpacity={0.35} isAnimationActive={false} />
                  <ReferenceDot x={knee.x} y={knee.y} r={9} fill={c.amber} stroke="#fff" strokeWidth={2}>
                    <Label value="Utopia point" position="left" offset={12} fill={c.tickRight} fontSize={12} fontWeight="bold" />
                  </ReferenceDot>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <CardHeader
            title="Chart 2B · Actionable monthly quotas"
            sub={forecast
              ? `${forecast.forecastYear}: ${fmtInt(s.capK)}k cap split by SARIMAX seasonal shape · peak ${forecast.peak.label} ${fmtInt(forecast.peak.quotaK)}k, trough ${forecast.trough.label} ${fmtInt(forecast.trough.quotaK)}k`
              : 'Monthly quotas unavailable'}
            right={<Badge tone="amber">SDG 11</Badge>}
          />
          {quotaData ? (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={quotaData} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: 12 }} dy={8} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v)}k`} tick={{ fill: c.tickLeft, fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v)}k`} tick={{ fill: c.tickRight, fontSize: 12 }} />
                    <Tooltip
                      {...c.tooltip}
                      cursor={{ fill: c.cursorFill }}
                      formatter={(v) => (Array.isArray(v) ? `${fmtInt(Number(v[0]))}k – ${fmtInt(Number(v[1]))}k` : `${fmtInt(Number(v))}k`)}
                    />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ paddingTop: '12px', fontSize: 12 }} formatter={legendText} />
                    <defs>
                      <linearGradient id="lk-quota-bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.skyBright} />
                        <stop offset="100%" stopColor={c.sky} stopOpacity={0.75} />
                      </linearGradient>
                      <linearGradient id="lk-quota-peak" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.amber} />
                        <stop offset="100%" stopColor={c.amber} stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="lk-quota-trough" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.rose} />
                        <stop offset="100%" stopColor={c.rose} stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <Area yAxisId="right" dataKey="band" name="Demand 95% band" stroke="none" fill={c.amber} fillOpacity={0.16} isAnimationActive={false} />
                    <Bar yAxisId="left" dataKey="quota" name="Enforced quota" fill="url(#lk-quota-bar)" radius={[8, 8, 0, 0]} maxBarSize={30}>
                      {quotaData.map((q) => (
                        <Cell
                          key={q.label}
                          fill={
                            q.label === forecast!.peak.label ? 'url(#lk-quota-peak)'
                              : q.label === forecast!.trough.label ? 'url(#lk-quota-trough)'
                                : 'url(#lk-quota-bar)'
                          }
                        />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="demand" name="SARIMAX demand" stroke={c.tickRight} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
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

      {forecast?.telemetry && (
        <GlassCard className="p-5">
          <CardHeader title={`H1 ${forecast.forecastYear} live check`} sub="Recorded arrivals against the forecast corridor" />
          <p className="text-sm">
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
