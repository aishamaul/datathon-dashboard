'use client';

import { useMemo, useState } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Label, LabelList, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  POLICY_MILESTONES,
  type ArrivalsData, type CatalystResult, type CoralChangeResult, type RegressionChart, type RegressionPoint,
} from '@/lib/engine/langkawi';
import { fmt2, fmtInt, signedPct } from '@/lib/format';
import { useChartColors, useNarrow } from './chart-theme';
import { Badge, CardHeader, GlassCard, WaveBackdrop } from './ui';

const minus = (s: string) => s.replace('-', '−');
const fmtR = (r: number) => minus(r.toFixed(4));
const fmtP = (p: number) => (p < 0.0001 ? '< 0.0001' : p.toFixed(4));

/** Round tick values covering [lo, hi] with about `target` ticks. */
function niceAxis(lo: number, hi: number, target = 5) {
  const span = hi - lo || 1;
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(+v.toFixed(10));
  let decimals = 0;
  while (decimals < 6 && Math.abs(step * 10 ** decimals - Math.round(step * 10 ** decimals)) > 1e-9) decimals++;
  return { domain: [start, end] as [number, number], ticks, decimals };
}

// ---------------------------------------------------------------------------
// Tourist arrivals trend: yearly overview or month-by-month for a chosen year
// ---------------------------------------------------------------------------

type ArrivalsView = 'yearly' | number;

export function ArrivalsTrendCard({ arrivals }: { arrivals: ArrivalsData }) {
  const c = useChartColors();
  const narrow = useNarrow();
  const legendText = (value: string) => <span style={{ color: c.tickX }}>{value}</span>;
  const [view, setView] = useState<ArrivalsView>('yearly');
  const monthly = typeof view === 'number' ? arrivals.monthlyByYear[view] : undefined;
  const isMonthly = monthly !== undefined;

  const milestones = useMemo(
    () => POLICY_MILESTONES.filter((m) => arrivals.yearly.some((y) => y.year === m.year)),
    [arrivals],
  );

  const rows: { label: string | number; primary: number; secondary: number | null }[] = isMonthly
    ? monthly.map((m) => ({ label: m.label, primary: m.total, secondary: m.international }))
    : arrivals.yearly.map((y) => ({ label: y.year, primary: y.arrivalsM, secondary: y.receiptsM }));

  // Monthly counts switch to "K" once the values are large enough for it to read well.
  const totalMax = isMonthly ? Math.max(...monthly.map((m) => m.total)) : 0;
  const intlMax = isMonthly ? Math.max(0, ...monthly.map((m) => m.international ?? 0)) : 0;
  const leftK = totalMax >= 10000;
  const rightK = intlMax >= 10000;
  const countTick = (useK: boolean) => (v: number) => (useK ? `${+(v / 1000).toFixed(1)}K` : fmtInt(v));

  const primaryName = isMonthly ? 'Total Arrivals' : 'Tourist Arrivals (millions)';
  const secondaryName = isMonthly ? 'International Arrivals' : 'Tourism Receipts (RM mil)';

  return (
    <GlassCard className="p-6 relative overflow-hidden">
      <WaveBackdrop />
      <div className="relative">
        <CardHeader
          title="Overview · Tourist arrivals trend"
          sub={isMonthly ? `Monthly arrivals, ${view}` : 'Tourist arrivals and tourism receipts'}
          right={
            <select
              aria-label="Choose the arrivals view"
              value={view === 'yearly' ? 'yearly' : String(view)}
              onChange={(e) => setView(e.target.value === 'yearly' ? 'yearly' : Number(e.target.value))}
              className="shrink-0 cursor-pointer rounded-full bg-sky-500 px-4 py-1.5 pr-8 text-xs font-bold text-white shadow-md shadow-sky-500/25 outline-none transition hover:bg-sky-600 focus-visible:ring-2 focus-visible:ring-sky-300 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <option value="yearly" className="bg-white text-sky-900">Yearly Overview</option>
              {arrivals.monthlyYears.map((y) => (
                <option key={y} value={String(y)} className="bg-white text-sky-900">Monthly - {y}</option>
              ))}
            </select>
          }
        />
        <div className={narrow ? 'h-96' : 'h-80'}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart key={String(view)} data={rows} margin={{ top: 10, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="lk-arrivals-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.skyBright} stopOpacity={0.55} />
                  <stop offset="60%" stopColor={c.ringFrom} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={c.amber} stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
              <XAxis dataKey="label" height={48} axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: 12 }} dy={8}>
                <Label value={isMonthly ? `Month (${view})` : 'Year'} position="insideBottom" offset={0} fill={c.tickX} fontSize={12} />
              </XAxis>
              <YAxis
                yAxisId="left" width={narrow ? 46 : 64} axisLine={false} tickLine={false} tick={{ fill: c.tickLeft, fontSize: 12 }}
                tickFormatter={isMonthly ? countTick(leftK) : (v: number) => `${v}M`}
              >
                <Label
                  value={isMonthly ? `Total arrivals (${leftK ? 'thousands' : 'visitors'})` : 'Tourist arrivals (millions)'}
                  angle={-90} position="insideLeft" offset={10} fill={c.tickLeft} fontSize={12} style={{ textAnchor: 'middle' }}
                />
              </YAxis>
              <YAxis
                yAxisId="right" orientation="right" width={narrow ? 50 : isMonthly ? 64 : 82} axisLine={false} tickLine={false}
                tick={{ fill: c.tickRight, fontSize: 12 }}
                tickFormatter={isMonthly ? countTick(rightK) : (v: number) => `${narrow ? '' : 'RM '}${+(v / 1000).toFixed(1)}B`}
              >
                <Label
                  value={isMonthly ? `International arrivals (${rightK ? 'thousands' : 'visitors'})` : 'Tourism receipts (RM billion)'}
                  angle={90} position="insideRight" offset={10} fill={c.tickRight} fontSize={12} style={{ textAnchor: 'middle' }}
                />
              </YAxis>
              <Tooltip
                {...c.tooltip}
                cursor={{ stroke: c.refLine, strokeWidth: 1 }}
                formatter={(v, name) => {
                  if (typeof v !== 'number') return String(v);
                  if (isMonthly) return fmtInt(v);
                  return name === secondaryName ? `RM ${fmtInt(v)}M` : `${fmt2(v)}M`;
                }}
              />
              <Legend iconType="circle" iconSize={9} verticalAlign="bottom" wrapperStyle={{ paddingTop: '6px', fontSize: 12 }} formatter={legendText} />
              {!isMonthly && milestones.map((m, i) => (
                <ReferenceLine key={m.year} x={m.year} yAxisId="left" stroke={c.rose} strokeDasharray="4 4">
                  <Label
                    value={m.short} position="insideTopLeft" fill={c.roseText} fontSize={12} fontWeight="bold"
                    dy={narrow ? (i % 2) * 16 : 0}
                  />
                </ReferenceLine>
              ))}
              <Area
                yAxisId="left" type="monotone" dataKey="primary" name={primaryName}
                stroke={c.sky} strokeWidth={3} fill="url(#lk-arrivals-fill)" activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="right" type={isMonthly ? 'monotone' : 'stepAfter'} dataKey="secondary" name={secondaryName}
                stroke={c.amber} strokeWidth={3} dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Revenue regressions: scatter + OLS line + 95% confidence band
// ---------------------------------------------------------------------------

interface RegressionCardProps {
  title: string;
  result: RegressionChart | null;
  tone: 'sky' | 'rose';
  badgeTone: 'sky' | 'amber';
  xLabel: string;
  yLabel: string;
  yName: string;
  yTick: (v: number) => string;
  yTip: (v: number) => string;
  note: string;
  missing: string;
}

export function RegressionCard({
  title, result, tone, badgeTone, xLabel, yLabel, yName, yTick, yTip, note, missing,
}: RegressionCardProps) {
  const c = useChartColors();
  const [hover, setHover] = useState<{ pt: RegressionPoint; cx: number; cy: number; align: 'left' | 'center' | 'right' } | null>(null);
  const stroke = tone === 'sky' ? c.sky : c.rose;
  const dot = tone === 'sky' ? c.skyBright : c.rose;
  // Axes must cover the whole confidence band, not just the dots.
  const axes = useMemo(() => {
    if (!result) return null;
    const xs = result.points.map((p) => p.x);
    const ys = [...result.points.map((p) => p.y), ...result.band.map((b) => b.lo), ...result.band.map((b) => b.hi)];
    return { x: niceAxis(Math.min(...xs), Math.max(...xs), 6), y: niceAxis(Math.min(...ys), Math.max(...ys), 6) };
  }, [result]);

  return (
    <GlassCard className="p-6">
      <CardHeader
        title={title}
        sub={result
          ? `r = ${fmtR(result.r)} · R² = ${fmt2(result.r2)} · p = ${fmtP(result.p)} · ${result.n} years (${result.firstYear}–${result.lastYear})`
          : `Tourism receipts vs ${yName}`}
        right={result ? <Badge tone={badgeTone}>R² = {fmt2(result.r2)}</Badge> : undefined}
      />
      {result ? (
        <>
          <div className="relative h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 10, right: 16, left: 4, bottom: 22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                <XAxis
                  type="number" dataKey="x" domain={axes!.x.domain} ticks={axes!.x.ticks} tickFormatter={(v: number) => fmtInt(v)}
                  axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: 12 }}
                >
                  <Label value={xLabel} position="insideBottom" offset={-14} fill={c.tickX} fontSize={12} />
                </XAxis>
                <YAxis
                  type="number" dataKey="y" width={64} domain={axes!.y.domain} ticks={axes!.y.ticks} tickFormatter={yTick}
                  axisLine={false} tickLine={false} tick={{ fill: c.tickLeft, fontSize: 12 }}
                >
                  <Label value={yLabel} angle={-90} position="insideLeft" offset={10} fill={c.tickLeft} fontSize={12} style={{ textAnchor: 'middle' }} />
                </YAxis>
                <Area data={result.band} dataKey="range" stroke="none" fill={stroke} fillOpacity={0.18} isAnimationActive={false} legendType="none" />
                <Line data={result.band} dataKey="fit" stroke={stroke} strokeWidth={2.5} dot={false} activeDot={false} isAnimationActive={false} legendType="none" />
                <Scatter
                  data={result.points} isAnimationActive={false}
                  shape={(props: unknown) => {
                    const p = props as { cx?: number; cy?: number; payload?: RegressionPoint };
                    if (p.cx === undefined || p.cy === undefined || !p.payload) return <g />;
                    const { cx, cy, payload } = p;
                    return (
                      <circle
                        cx={cx} cy={cy} r={5.5} fill={dot} style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          const w = e.currentTarget.ownerSVGElement?.clientWidth ?? 0;
                          setHover({ pt: payload, cx, cy, align: cx > w * 0.7 ? 'right' : cx < w * 0.3 ? 'left' : 'center' });
                        }}
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {hover && (
              <div
                className="pointer-events-none absolute z-10"
                style={{
                  ...c.tooltip.contentStyle,
                  left: hover.cx,
                  top: hover.cy - 10,
                  padding: '8px 12px',
                  whiteSpace: 'nowrap',
                  transform: `translate(${hover.align === 'right' ? '-100%' : hover.align === 'left' ? '0' : '-50%'}, -100%)`,
                }}
              >
                <p style={{ ...c.tooltip.labelStyle, margin: 0 }}>{hover.pt.year}</p>
                <p style={{ ...c.tooltip.itemStyle, margin: '4px 0 0', fontSize: 12 }}>Tourism receipts: RM {fmtInt(hover.pt.x)}M</p>
                <p style={{ ...c.tooltip.itemStyle, margin: '2px 0 0', fontSize: 12 }}>{yName}: {yTip(hover.pt.y)}</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-sky-700/80 dark:text-sky-300/80">{note}</p>
        </>
      ) : (
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{missing}</p>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Policy catalyst: length of stay with intervention markers and the before/after t-test
// ---------------------------------------------------------------------------

function milestoneLabel(viewBox: unknown, text: string, color: string) {
  const v = viewBox as { x?: number; y?: number; height?: number } | undefined;
  if (!v || v.x === undefined || v.y === undefined || v.height === undefined) return null;
  return (
    <text transform={`translate(${v.x + 13}, ${v.y + v.height * 0.62}) rotate(-90)`} fill={color} fontSize={11} fontWeight={700}>
      {text}
    </text>
  );
}

export function CatalystCard({ catalyst }: { catalyst: CatalystResult }) {
  const c = useChartColors();
  const { points, milestones, test } = catalyst;
  const axis = useMemo(() => {
    const values = points.map((p) => p.alos);
    return niceAxis(Math.min(...values) - 0.05, Math.max(...values) + 0.1, 5);
  }, [points]);
  const blueprint = milestones.find((m) => m.year === catalyst.blueprintYear);
  const significant = test !== null && test.p < 0.05;
  const changePct = test ? (test.mean2 / test.mean1 - 1) * 100 : 0;

  return (
    <GlassCard className="p-6">
      <CardHeader
        title="Policy · Langkawi policy catalyst"
        sub={`Average length of stay with policy milestones, ${points[0].year}–${points[points.length - 1].year}`}
        right={<Badge tone="sky">SDG 9</Badge>}
      />
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 16, left: 4, bottom: 22 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: 12 }} dy={8}>
              <Label value="Year" position="insideBottom" offset={-14} fill={c.tickX} fontSize={12} />
            </XAxis>
            <YAxis
              width={64} axisLine={false} tickLine={false} tick={{ fill: c.tickLeft, fontSize: 12 }}
              domain={axis.domain} ticks={axis.ticks} tickFormatter={(v: number) => v.toFixed(axis.decimals)}
            >
              <Label value="Average length of stay (nights)" angle={-90} position="insideLeft" offset={10} fill={c.tickLeft} fontSize={12} style={{ textAnchor: 'middle' }} />
            </YAxis>
            <Tooltip
              {...c.tooltip}
              cursor={{ stroke: c.refLine, strokeWidth: 1 }}
              formatter={(v) => (typeof v === 'number' ? `${fmt2(v)} nights` : String(v))}
            />
            {milestones.map((m) => (
              <ReferenceLine key={m.year} x={m.year} stroke={c.rose} strokeDasharray="4 4" strokeWidth={1.5}>
                <Label content={(props) => milestoneLabel(props.viewBox, m.label, c.roseText)} />
              </ReferenceLine>
            ))}
            <Line
              type="monotone" dataKey="alos" name="Average length of stay" stroke={c.ringText} strokeWidth={3}
              dot={{ r: 4, fill: c.ringText, stroke: c.ringText }} activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {test ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="sky">Pre-policy mean ({test.preFrom}–{test.preTo}): {fmt2(test.mean1)} nights</Badge>
            <Badge tone="teal">Post-policy mean ({test.postFrom}–{test.postTo}): {fmt2(test.mean2)} nights</Badge>
            <Badge tone={significant ? 'amber' : 'rose'}>Welch t = {minus(test.t.toFixed(4))} · p = {test.p < 0.0001 ? '< 0.0001' : test.p.toFixed(5)}</Badge>
          </div>
          <p className="mt-3 text-xs text-sky-700/80 dark:text-sky-300/80">
            {significant
              ? `Stays from ${test.postFrom} are ${signedPct(changePct)} against the pre-policy average (${fmt2(test.mean1)} to ${fmt2(test.mean2)} nights), a statistically significant difference at the 5% level.`
              : `Stays from ${test.postFrom} differ by ${signedPct(changePct)} from the pre-policy average, which is not statistically significant at the 5% level.`}
            {blueprint ? ` The split is at the ${blueprint.label} (${blueprint.year}).` : ''}
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-sky-700/80 dark:text-sky-300/80">
          The before/after test needs at least two years on each side of {catalyst.blueprintYear}.
        </p>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Coral net change (environmental resilience)
// ---------------------------------------------------------------------------

function coralLabel(props: unknown, fill: string) {
  const p = props as { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string };
  const x = Number(p.x);
  const y = Number(p.y);
  const w = Number(p.width);
  const h = Number(p.height);
  const value = Number(p.value);
  if (![x, y, w, h, value].every(Number.isFinite)) return null;
  const top = Math.min(y, y + h);
  const bottom = Math.max(y, y + h);
  return (
    <text x={x + w / 2} y={value < 0 ? bottom + 14 : top - 6} textAnchor="middle" fill={fill} fontSize={12} fontWeight={700}>
      {signedPct(value, 1)}
    </text>
  );
}

export function CoralChangeCard({ coral }: { coral: CoralChangeResult }) {
  const c = useChartColors();
  const values = coral.bars.map((b) => b.changePct);
  const axis = useMemo(
    () => niceAxis(Math.min(0, Math.min(...values) * 1.15), Math.max(0, Math.max(...values) * 1.15)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coral],
  );
  const proxy = coral.proxy;
  const proxyShort = proxy ? proxy.island.replace(/^Pulau\s+/i, '') : '';
  const span = coral.lastYear - coral.firstYear + 1;

  return (
    <GlassCard className="p-6">
      <CardHeader
        title="Sustainability · Live coral cover change"
        sub={`${span}-year net change in live coral cover, ${coral.firstYear}–${coral.lastYear} (first to last survey)`}
        right={proxy ? <Badge tone="teal">{proxyShort} {proxy.z >= 0 ? '+' : '−'}{Math.abs(proxy.z).toFixed(2)} SD</Badge> : <Badge tone="teal">SDG 14</Badge>}
      />
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={coral.bars} margin={{ top: 10, right: 16, left: 4, bottom: 22 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
            <XAxis dataKey="short" axisLine={false} tickLine={false} tick={{ fill: c.tickX, fontSize: 12 }} dy={8}>
              <Label value="Island" position="insideBottom" offset={-14} fill={c.tickX} fontSize={12} />
            </XAxis>
            <YAxis
              width={64} domain={axis.domain} ticks={axis.ticks} axisLine={false} tickLine={false}
              tick={{ fill: c.tickLeft, fontSize: 12 }} tickFormatter={(v: number) => `${minus(String(v))}%`}
            >
              <Label value="Net change in live coral cover (%)" angle={-90} position="insideLeft" offset={10} fill={c.tickLeft} fontSize={12} style={{ textAnchor: 'middle' }} />
            </YAxis>
            <Tooltip
              {...c.tooltip}
              cursor={{ fill: c.cursorFill }}
              formatter={(v) => (typeof v === 'number' ? signedPct(v, 2) : String(v))}
            />
            <ReferenceLine y={0} stroke={c.muted} strokeWidth={1.5} />
            <Bar dataKey="changePct" name="Net change" radius={6} maxBarSize={72}>
              {coral.bars.map((b) => (
                <Cell key={b.island} fill={b.isProxy ? c.teal : c.amber} fillOpacity={b.isProxy ? 1 : 0.85} />
              ))}
              <LabelList dataKey="changePct" content={(props) => coralLabel(props, c.tickX)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="amber">Island average: {signedPct(coral.mean, 2)}</Badge>
        {proxy && <Badge tone="teal">{proxy.island}: {signedPct(proxy.changePct, 2)}</Badge>}
      </div>
      {proxy && (
        <p className="mt-3 text-xs text-sky-700/80 dark:text-sky-300/80">
          {proxyShort} changed by {signedPct(proxy.changePct, 2)} against an island average of {signedPct(coral.mean, 2)}, which is{' '}
          {Math.abs(proxy.z).toFixed(2)} standard deviations {proxy.z >= 0 ? 'above' : 'below'} the mean resilience baseline
          {proxy.z >= 1 ? ", consistent with Langkawi's marine management shielding its proxy reef." : '.'}
        </p>
      )}
    </GlassCard>
  );
}
