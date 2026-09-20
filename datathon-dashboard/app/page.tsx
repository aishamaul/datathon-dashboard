"use client";

import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  LineChart, Line, BarChart, Bar, Cell, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  ComposedChart, Area, Label
} from 'recharts';
// Note: lucide's "Map" icon is imported as MapIcon so it doesn't clash with JavaScript's built-in Map
import { Map as MapIcon, ShieldCheck, CheckSquare, Square, Palmtree, Waves, Users } from 'lucide-react';

// =====================================================================
// SETTINGS
// =====================================================================

// The Excel file must sit in your project's  public/  folder
const EXCEL_PATH = '/data_cleaned.xlsx';

// Island highlighted in blue on the coral chart and used for the "survival" z-score
const HIGHLIGHT_ISLAND = 'Pulau Payar';

// Not in the Excel file: comes from your own statistical test, so it stays typed in
const ALOS_P_VALUE = '< 0.0002';

type IslandKey = 'Redang' | 'Tioman' | 'Perhentian';

// Not in the Excel file: your own simulator assumptions (edit freely)
const islandAssumptions: Record<IslandKey, { area: number; capBase: number; alosBase: number }> = {
  Redang: { area: 25, capBase: 800, alosBase: 1.2 },
  Tioman: { area: 136, capBase: 2500, alosBase: 1.8 },
  Perhentian: { area: 15.3, capBase: 400, alosBase: 1.5 },
};

// =====================================================================
// LOADING + CALCULATING DATA FROM THE EXCEL FILE
// =====================================================================

interface YearlyPoint { year: number; arrivals: number; revenue: number; alos: number; decoupling: number }
interface MonthlyPoint { label: string; total: number; international: number }
interface CoralPoint { name: string; change: number; fill: string }

interface DashboardData {
  yearly: YearlyPoint[];                       // MASTER + OVERALL TOURISTS
  monthly: MonthlyPoint[];                     // OVERALL TOURISTS BY MONTH (latest year)
  monthlyYear: number;
  wealth: { arrivals: number; gdp: number }[]; // OVERALL TOURISTS + GDP
  jobs: { receipts: number; unemp: number }[]; // MASTER + LANGKAWI EMPLOYMENT & LABOUR
  coral: CoralPoint[];                         // CORAL REEF STATUS
  coralFrom: number;
  coralTo: number;
  unemp: { firstYear: number; first: number; lastYear: number; last: number };
  highlightZ: number | null;
  wealthR2: number | null;
  jobsR2: number | null;
  islandDegradation: Record<IslandKey, number>;
}

type Row = Record<string, any>;

const readSheet = (wb: XLSX.WorkBook, name: string): Row[] => {
  const ws = wb.Sheets[name];
  if (!ws) {
    throw new Error(`Sheet "${name}" was not found in the Excel file. Sheets found: ${wb.SheetNames.join(', ')}`);
  }
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
};

// R² of a straight-line fit (returns null when there are too few points)
const rSquared = (pts: { x: number; y: number }[]): number | null => {
  const n = pts.length;
  if (n < 3) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  pts.forEach((p) => {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) * (p.x - mx);
    syy += (p.y - my) * (p.y - my);
  });
  if (sxx === 0 || syy === 0) return null;
  return (sxy * sxy) / (sxx * syy);
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const toMillions = (n: number) => Math.round(n / 1e4) / 100; // 3215730 -> 3.22

const buildDashboardData = (wb: XLSX.WorkBook): DashboardData => {
  const master = readSheet(wb, 'MASTER');
  const overall = readSheet(wb, 'OVERALL TOURISTS');
  const monthlyRows = readSheet(wb, 'OVERALL TOURISTS BY MONTH');
  const coralRows = readSheet(wb, 'CORAL REEF STATUS');
  const labour = readSheet(wb, 'LANGKAWI EMPLOYMENT & LABOUR');
  const gdpRows = readSheet(wb, 'GDP');

  // Total tourist arrivals per year, in millions
  const arrivalsM = new Map<number, number>();
  overall.forEach((r) => arrivalsM.set(Number(r.YEAR), toMillions(Number(r.TOTAL))));

  // ---- Yearly chart + KPI cards ----
  const yearly: YearlyPoint[] = master
    .filter((r) => arrivalsM.has(Number(r.Year)))
    .map((r) => ({
      year: Number(r.Year),
      arrivals: arrivalsM.get(Number(r.Year)) ?? 0,
      revenue: Number(r.Tourism_Receipts_RM_mil),
      alos: Number(r.Average_Length_of_Stay_nights),
      decoupling: Number(r.Decoupling_Index_RM_per_Ton),
    }))
    .sort((a, b) => a.year - b.year);
  if (yearly.length < 2) throw new Error('Not enough yearly rows found in the MASTER / OVERALL TOURISTS sheets.');

  // ---- Monthly chart (latest year available) ----
  const monthlyYear = Math.max(...monthlyRows.map((r) => Number(r.YEAR)));
  const monthly: MonthlyPoint[] = monthlyRows
    .filter((r) => Number(r.YEAR) === monthlyYear)
    .map((r) => {
      const m = String(r.MONTH).trim().toUpperCase();
      return {
        idx: MONTHS.indexOf(m),
        label: m.charAt(0) + m.slice(1).toLowerCase(),
        total: Number(r.TOTAL),
        international: Number(r.INTERNATIONAL),
      };
    })
    .sort((a, b) => a.idx - b.idx)
    .map((r) => ({ label: r.label, total: r.total, international: r.international }));

  // ---- Unemployment (Langkawi) ----
  const unempByYear = new Map<number, number>();
  labour.forEach((r) => unempByYear.set(Number(r.Year), Number(r.Unemployment_Rate_pct)));
  const unempYears = Array.from(unempByYear.keys()).sort((a, b) => a - b);
  if (unempYears.length === 0) throw new Error('No rows found in the LANGKAWI EMPLOYMENT & LABOUR sheet.');
  const firstUnempYear = unempYears[0];
  const lastUnempYear = unempYears[unempYears.length - 1];
  const unemp = {
    firstYear: firstUnempYear,
    first: unempByYear.get(firstUnempYear) ?? 0,
    lastYear: lastUnempYear,
    last: unempByYear.get(lastUnempYear) ?? 0,
  };

  // ---- Scatterplots ----
  // Chart 1B: receipts vs unemployment, for years present in both sheets
  const jobs = yearly
    .filter((y) => unempByYear.has(y.year))
    .map((y) => ({ receipts: y.revenue, unemp: unempByYear.get(y.year) ?? 0 }));

  // Chart 1A: tourist arrivals vs GDP, for years present in both sheets
  // (the GDP sheet stops at 2020, before receipts data begins in 2019, so arrivals are used on the x-axis)
  const wealth = gdpRows
    .filter((r) => arrivalsM.has(Number(r.Year)))
    .map((r) => ({
      arrivals: arrivalsM.get(Number(r.Year)) ?? 0,
      gdp: Math.round(Number(r.GDP_at_Purchasers_Prices)),
    }));

  const wealthR2 = rSquared(wealth.map((w) => ({ x: w.arrivals, y: w.gdp })));
  const jobsR2 = rSquared(jobs.map((j) => ({ x: j.receipts, y: j.unemp })));

  // ---- Coral: change in live coral cover (percentage points), first survey year -> last survey year ----
  const byIsland = new Map<string, { year: number; live: number }[]>();
  coralRows.forEach((r) => {
    const key = String(r.Island).trim();
    const list = byIsland.get(key) ?? [];
    list.push({ year: Number(r.Year), live: Number(r.Live_Coral_Cover_Pct) * 100 }); // sheet stores 0.4488 = 44.88%
    byIsland.set(key, list);
  });
  const raw = Array.from(byIsland.entries()).map(([island, pts]) => {
    const sorted = pts.slice().sort((a, b) => a.year - b.year);
    const f = sorted[0];
    const l = sorted[sorted.length - 1];
    return { island, from: f.year, to: l.year, change: l.live - f.live };
  });
  if (raw.length === 0) throw new Error('No rows found in the CORAL REEF STATUS sheet.');

  // z-score of the highlighted island against all islands (population standard deviation)
  const changes = raw.map((r) => r.change);
  const mean = changes.reduce((s, c) => s + c, 0) / changes.length;
  const sd = Math.sqrt(changes.reduce((s, c) => s + (c - mean) * (c - mean), 0) / changes.length);
  const highlight = raw.find((r) => r.island === HIGHLIGHT_ISLAND);
  const highlightZ = highlight && sd > 0 ? (highlight.change - mean) / sd : null;

  const coral: CoralPoint[] = raw
    .map((r) => ({
      name: r.island.replace(/^Pulau\s+/i, ''),
      change: Math.round(r.change * 100) / 100,
      fill: r.island === HIGHLIGHT_ISLAND ? '#0ea5e9' : '#fb7185',
    }))
    .sort((a, b) => b.change - a.change);

  const degradationOf = (key: IslandKey): number => {
    const hit = raw.find((r) => r.island === `Pulau ${key}`);
    if (!hit) throw new Error(`"Pulau ${key}" was not found in the CORAL REEF STATUS sheet.`);
    return Math.round(hit.change * 10) / 10;
  };

  return {
    yearly,
    monthly,
    monthlyYear,
    wealth,
    jobs,
    coral,
    coralFrom: Math.min(...raw.map((r) => r.from)),
    coralTo: Math.max(...raw.map((r) => r.to)),
    unemp,
    highlightZ,
    wealthR2,
    jobsR2,
    islandDegradation: {
      Redang: degradationOf('Redang'),
      Tioman: degradationOf('Tioman'),
      Perhentian: degradationOf('Perhentian'),
    },
  };
};

// =====================================================================
// SHARED UI PIECES
// =====================================================================

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid #bae6fd',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 8px 24px rgba(14,116,144,0.15)',
};

const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-2xl border border-sky-200/80 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(14,116,144,0.08)] ${className}`}
  >
    {children}
  </div>
);

const CardHeader = ({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 mb-4">
    <div>
      <h2 className="text-sm font-bold text-sky-950 leading-tight">{title}</h2>
      {sub && <p className="text-xs text-sky-700/70 mt-0.5">{sub}</p>}
    </div>
    {right}
  </div>
);

const Badge = ({ children, tone = 'sky' }: { children: React.ReactNode; tone?: 'sky' | 'amber' | 'teal' }) => {
  const tones = {
    sky: 'bg-sky-100 text-sky-800 border-sky-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    teal: 'bg-teal-100 text-teal-800 border-teal-200',
  };
  return (
    <span className={`shrink-0 px-3 py-1 text-[11px] font-bold rounded-full border ${tones[tone]}`}>{children}</span>
  );
};

// Donut ring, like the KPI cards in the reference
const Ring = ({ value, id }: { value: number; id: string }) => {
  const r = 30;
  const c = 2 * Math.PI * r;
  const shown = Math.min(100, Math.max(0, value));
  return (
    <svg width="80" height="80" viewBox="0 0 76 76" className="shrink-0">
      <defs>
        <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
      </defs>
      <circle cx="38" cy="38" r={r} fill="none" stroke="#e0f2fe" strokeWidth="8" />
      <circle
        cx="38" cy="38" r={r} fill="none"
        stroke={`url(#ring-${id})`} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(shown / 100) * c} ${c}`}
        transform="rotate(-90 38 38)"
      />
      <text x="38" y="43" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0c4a6e">{shown}%</text>
    </svg>
  );
};

// Faint wave decoration used behind the main chart (stands in for the world map in the reference)
const WaveBackdrop = () => (
  <svg
    className="absolute inset-0 w-full h-full opacity-60 pointer-events-none"
    viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden="true"
  >
    <path d="M0 300 C 100 260, 200 340, 300 300 S 500 260, 600 300 S 750 330, 800 290 L800 400 L0 400 Z" fill="#e0f2fe" />
    <path d="M0 340 C 120 310, 220 370, 340 338 S 540 306, 660 340 S 760 360, 800 336 L800 400 L0 400 Z" fill="#fef3c7" opacity="0.7" />
  </svg>
);

// =====================================================================
// PAGE 1: LANGKAWI BLUEPRINT
// =====================================================================

interface ChartPoint { label: string | number; arrivals: number; second: number }

const LangkawiBlueprint = ({ data }: { data: DashboardData }) => {
  const [viewMonthly, setViewMonthly] = useState(false);

  const { yearly, unemp } = data;
  const first = yearly[0];
  const last = yearly[yearly.length - 1];

  const ringOf = (from: number, to: number) => Math.abs(Math.round(((to - from) / from) * 100));
  const dir = (from: number, to: number) => (to >= from ? 'Up' : 'Down');

  const kpis = [
    {
      id: 'receipts',
      title: 'Total tourism receipts',
      since: first.year,
      value: `RM ${last.revenue.toLocaleString()}M`,
      note: `${dir(first.revenue, last.revenue)} from RM ${first.revenue.toLocaleString()}M in ${first.year}`,
      ring: ringOf(first.revenue, last.revenue),
    },
    {
      id: 'alos',
      title: 'Avg length of stay',
      since: first.year,
      value: `${last.alos.toFixed(2)} nights`,
      note: `${dir(first.alos, last.alos)} from ${first.alos.toFixed(2)} in ${first.year} (p ${ALOS_P_VALUE})`,
      ring: ringOf(first.alos, last.alos),
    },
    {
      id: 'unemp',
      title: `Unemployment rate, ${unemp.lastYear}`,
      since: unemp.firstYear,
      value: `${unemp.last.toFixed(1)}%`,
      note: `${dir(unemp.first, unemp.last)} from ${unemp.first.toFixed(1)}% in ${unemp.firstYear}`,
      ring: ringOf(unemp.first, unemp.last),
    },
    {
      id: 'decouple',
      title: 'Decoupling index',
      since: first.year,
      value: `RM ${Math.round(last.decoupling / 1000)}k / ton`,
      note: `${dir(first.decoupling, last.decoupling)} from RM ${Math.round(first.decoupling / 1000)}k in ${first.year}`,
      ring: ringOf(first.decoupling, last.decoupling),
    },
  ];

  const chartData: ChartPoint[] = viewMonthly
    ? data.monthly.map((m) => ({ label: m.label, arrivals: m.total, second: m.international }))
    : yearly.map((y) => ({ label: y.year, arrivals: y.arrivals, second: y.revenue }));

  const highlightShort = HIGHLIGHT_ISLAND.replace(/^Pulau\s+/i, '');
  const zText = data.highlightZ === null ? null : `${data.highlightZ >= 0 ? '+' : ''}${data.highlightZ.toFixed(2)}`;
  const fmtR2 = (v: number | null) => (v === null ? 'n/a' : v.toFixed(2));

  return (
    <div className="space-y-5 text-sky-950">

      {/* Row 1: KPI cards with donut rings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((k) => (
          <GlassCard key={k.id} className="p-5">
            <CardHeader title={k.title} sub={`Change since ${k.since}`} />
            <div className="flex items-center gap-4">
              <Ring value={k.ring} id={k.id} />
              <div>
                <p className="text-2xl font-black tracking-tight text-sky-950 leading-none">{k.value}</p>
                <p className="text-xs text-sky-700/70 mt-2">{k.note}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Row 2: main wave chart + highlights panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <GlassCard className="xl:col-span-8 p-6 relative overflow-hidden">
          <WaveBackdrop />
          <div className="relative">
            <CardHeader
              title="The policy catalyst (SDG 9)"
              sub={viewMonthly ? `Monthly arrivals, ${data.monthlyYear}` : 'Tourist arrivals and tourism receipts'}
              right={
                <button
                  onClick={() => setViewMonthly(!viewMonthly)}
                  className="px-4 py-1.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-xs rounded-full shadow-md shadow-sky-500/25 hover:from-sky-600 hover:to-cyan-600 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  View: {viewMonthly ? 'Monthly' : 'Yearly'}
                </button>
              }
            />
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="arrivalsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.55} />
                      <stop offset="60%" stopColor="#67e8f9" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#fde68a" stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#bae6fd" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#0369a1', fontSize: 12 }} dy={10} />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(val) => (viewMonthly ? `${Math.round(val / 1000)}K` : `${val}M`)}
                    axisLine={false} tickLine={false} tick={{ fill: '#0284c7', fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="right" orientation="right"
                    tickFormatter={(val) => (viewMonthly ? `${Math.round(val / 1000)}K` : `RM ${+(val / 1000).toFixed(1)}B`)}
                    axisLine={false} tickLine={false} tick={{ fill: '#d97706', fontSize: 12 }}
                  />
                  <Tooltip cursor={{ stroke: '#7dd3fc', strokeWidth: 1 }} contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />

                  {!viewMonthly && (
                    <>
                      <ReferenceLine x={2020} stroke="#fb7185" strokeDasharray="4 4" yAxisId="left">
                        <Label value="HELANG" position="insideTopLeft" fill="#e11d48" fontSize={12} fontWeight="bold" />
                      </ReferenceLine>
                      <ReferenceLine x={2021} stroke="#fb7185" strokeDasharray="4 4" yAxisId="left">
                        <Label value="1T1T" position="insideTopLeft" fill="#e11d48" fontSize={12} fontWeight="bold" />
                      </ReferenceLine>
                      <ReferenceLine x={2024} stroke="#fb7185" strokeDasharray="4 4" yAxisId="left">
                        <Label value="LUGGp" position="insideTopLeft" fill="#e11d48" fontSize={12} fontWeight="bold" />
                      </ReferenceLine>
                    </>
                  )}

                  <Area
                    yAxisId="left" type="monotone" dataKey="arrivals"
                    name={viewMonthly ? 'Total Arrivals' : 'Tourist Arrivals (millions)'}
                    stroke="#0284c7" strokeWidth={3} fill="url(#arrivalsFill)" activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right" type={viewMonthly ? 'monotone' : 'stepAfter'} dataKey="second"
                    name={viewMonthly ? 'International Arrivals' : 'Tourism Receipts (RM mil)'}
                    stroke="#f59e0b" strokeWidth={3} dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>

        {/* Highlights panel (mirrors the total + pill list on the right of the reference) */}
        <GlassCard className="xl:col-span-4 p-6 flex flex-col">
          <CardHeader title="Key findings" sub="Model and test results" />
          <div className="flex items-end gap-3 mb-1">
            <Users size={28} className="text-sky-500 mb-1" />
            <p className="text-5xl font-black tracking-tight text-sky-950 leading-none">{last.arrivals.toFixed(1)}M</p>
          </div>
          <p className="text-xs text-sky-700/70 mb-5">Tourist arrivals in {last.year}</p>
          <div className="flex items-baseline justify-between border-t border-sky-200/70 pt-3 mb-5">
            <span className="text-xs font-semibold text-sky-700">Total receipts</span>
            <span className="text-lg font-extrabold text-sky-950">RM {last.revenue.toLocaleString()}M</span>
          </div>

          <div className="space-y-3 mt-auto">
            <div className="flex items-center justify-between rounded-full bg-white/80 border border-sky-200 px-4 py-2.5">
              <span className="text-sm font-semibold text-sky-800">Wealth engine (R²)</span>
              <span className="text-sm font-black text-sky-950">{fmtR2(data.wealthR2)}</span>
            </div>
            <div className="flex items-center justify-between rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-2.5 shadow-md shadow-sky-500/30">
              <span className="text-sm font-semibold text-white">Length of stay (p)</span>
              <span className="text-sm font-black text-white">{ALOS_P_VALUE}</span>
            </div>
            <div className="flex items-center justify-between rounded-full bg-white/80 border border-sky-200 px-4 py-2.5">
              <span className="text-sm font-semibold text-sky-800">{highlightShort} survival (SD)</span>
              <span className="text-sm font-black text-sky-950">{zText ?? 'n/a'}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Row 3: bar chart + two scatterplots */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-6">
          <CardHeader
            title="Environmental resilience (SDG 14)"
            sub={`Live coral cover change, ${data.coralFrom}–${data.coralTo}`}
            right={zText ? <Badge tone="teal">{highlightShort} {zText} SD</Badge> : undefined}
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.coral} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#bae6fd" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#0369a1', fontSize: 11, fontWeight: 600 }} dy={8} />
                <YAxis tickFormatter={(val) => `${val}%`} axisLine={false} tickLine={false} tick={{ fill: '#0369a1', fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(186,230,253,0.35)' }} contentStyle={tooltipStyle} />
                <ReferenceLine y={0} stroke="#7dd3fc" strokeWidth={2} />
                <Bar dataKey="change" radius={[8, 8, 8, 8]}>
                  {data.coral.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <CardHeader
            title="Chart 1A: Wealth engine"
            sub="Tourist arrivals vs GDP"
            right={data.wealthR2 !== null ? <Badge>R² = {data.wealthR2.toFixed(2)}</Badge> : undefined}
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#bae6fd" />
                <XAxis dataKey="arrivals" type="number" domain={['auto', 'auto']} name="Arrivals" unit="M" axisLine={false} tickLine={false} tick={{ fill: '#0369a1', fontSize: 11 }} />
                <YAxis dataKey="gdp" type="number" domain={['auto', 'auto']} name="GDP" unit="M" axisLine={false} tickLine={false} tick={{ fill: '#0369a1', fontSize: 11 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                <Scatter name="Tourism Impact" data={data.wealth} fill="#0ea5e9" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <CardHeader
            title="Chart 1B: Grassroots jobs"
            sub="Receipts vs unemployment"
            right={data.jobsR2 !== null ? <Badge tone="amber">R² = {data.jobsR2.toFixed(2)}</Badge> : undefined}
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#bae6fd" />
                <XAxis dataKey="receipts" type="number" domain={['auto', 'auto']} name="Receipts" unit="M" axisLine={false} tickLine={false} tick={{ fill: '#0369a1', fontSize: 11 }} />
                <YAxis dataKey="unemp" type="number" domain={['auto', 'auto']} name="Unemployment" unit="%" axisLine={false} tickLine={false} tick={{ fill: '#0369a1', fontSize: 11 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                <Scatter name="Job Creation" data={data.jobs} fill="#f59e0b" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

// =====================================================================
// PAGE 2: ML POLICY SIMULATOR
// =====================================================================

const MLPolicySimulator = ({ data }: { data: DashboardData }) => {
  const [island, setIsland] = useState<IslandKey>('Redang');
  const [policies, setPolicies] = useState<Record<string, boolean>>({ fee: false, closure: false, zoning: false });

  const activeCount = Object.values(policies).filter(Boolean).length;
  const currentData = { ...islandAssumptions[island], degradation: data.islandDegradation[island] };

  const handleToggle = (key: string) => setPolicies((prev) => ({ ...prev, [key]: !prev[key] }));

  const simData = [
    { year: 2026, health: currentData.degradation },
    { year: 2027, health: currentData.degradation + activeCount * 3 },
    { year: 2028, health: currentData.degradation + activeCount * 7 },
    { year: 2029, health: currentData.degradation + activeCount * 12 },
    { year: 2030, health: currentData.degradation + activeCount * 18 },
  ];

  const targetCap = currentData.capBase - activeCount * 120;
  const targetAlos = (currentData.alosBase + activeCount * 0.4).toFixed(1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-sky-950">

      {/* Left: island selector + baseline */}
      <div className="lg:col-span-3 space-y-5">
        <GlassCard className="p-6">
          <CardHeader title="Target island" sub="Choose where to simulate" />
          <select
            className="w-full p-3 bg-white/80 border border-sky-200 rounded-xl text-sky-950 font-bold focus:ring-2 focus:ring-sky-300 outline-none cursor-pointer"
            value={island}
            onChange={(e) => setIsland(e.target.value as IslandKey)}
          >
            <option value="Redang">Pulau Redang</option>
            <option value="Tioman">Pulau Tioman</option>
            <option value="Perhentian">Pulau Perhentian</option>
          </select>
        </GlassCard>

        <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-700 text-white p-6 shadow-lg shadow-sky-700/25">
          <h3 className="font-bold text-base mb-5 flex items-center gap-3">
            <MapIcon size={20} className="text-sky-100" /> Physical baseline
          </h3>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center border-b border-white/20 pb-3">
              <span className="text-sky-100">Land area</span>
              <span className="font-black text-lg">{currentData.area} km²</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sky-100">Current degradation</span>
              <span className="font-black text-lg text-amber-200">{currentData.degradation}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: policy toggles */}
      <GlassCard className="lg:col-span-5 p-7">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-3">
          <ShieldCheck size={22} className="text-sky-500" /> Policy toggles
        </h3>
        <div className="space-y-3">
          {[
            { id: 'fee', label: 'Implement tiered tourism fee' },
            { id: 'closure', label: 'Activate seasonal marine closures' },
            { id: 'zoning', label: 'Enforce UNESCO-style zoning' },
          ].map((policy) => (
            <button
              type="button"
              key={policy.id}
              aria-pressed={policies[policy.id]}
              onClick={() => handleToggle(policy.id)}
              className={`w-full text-left flex items-center p-5 rounded-2xl border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                policies[policy.id]
                  ? 'bg-gradient-to-r from-sky-100 to-cyan-50 border-sky-300'
                  : 'bg-white/70 border-sky-100 hover:bg-white'
              }`}
            >
              {policies[policy.id] ? (
                <CheckSquare className="text-sky-500 mr-4 shrink-0" size={24} />
              ) : (
                <Square className="text-sky-300 mr-4 shrink-0" size={24} />
              )}
              <span className={`font-semibold ${policies[policy.id] ? 'text-sky-900' : 'text-sky-700/80'}`}>{policy.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Right: projection + gauges */}
      <div className="lg:col-span-4 space-y-5">
        <GlassCard className="p-6">
          <CardHeader title="Recovery trajectory" sub="Projected coral health change" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={simData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#bae6fd" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#0369a1', fontSize: 11 }} dy={10} />
                <YAxis tickFormatter={(val) => `${val}%`} axisLine={false} tickLine={false} tick={{ fill: '#0369a1', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone" dataKey="health"
                  stroke={activeCount > 1 ? '#0ea5e9' : '#fb7185'} strokeWidth={4}
                  dot={{ r: 5, fill: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200 p-5 flex flex-col justify-center items-center text-center shadow-sm">
            <p className="text-xs font-bold text-amber-700 mb-1">Target cap</p>
            <p className="text-3xl font-black text-amber-900">{targetCap}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 p-5 flex flex-col justify-center items-center text-center text-white shadow-md shadow-sky-500/25">
            <p className="text-xs font-bold text-sky-100 mb-1">Target ALOS</p>
            <p className="text-3xl font-black">{targetAlos}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// MAIN APP WRAPPER
// =====================================================================

export default function DashboardApp() {
  const [activePage, setActivePage] = useState('blueprint');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load and read the Excel file once, when the page opens
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(EXCEL_PATH);
        if (!res.ok) {
          throw new Error(
            `Could not load ${EXCEL_PATH} (HTTP ${res.status}). Make sure data_cleaned.xlsx is inside your project's public/ folder.`
          );
        }
        const buffer = await res.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const built = buildDashboardData(workbook);
        if (!cancelled) setData(built);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const last = data ? data.yearly[data.yearly.length - 1] : null;

  const pills = [
    { id: 'blueprint', label: 'The Langkawi Blueprint' },
    { id: 'simulator', label: 'ML Policy Simulator' },
  ];

  return (
    <div
      className="min-h-screen font-sans text-sky-950 selection:bg-sky-200"
      style={{
        backgroundImage:
          'repeating-linear-gradient(90deg, rgba(14,165,233,0.06) 0 1px, transparent 1px 96px), linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 40%, #ecfeff 72%, #fef3c7 125%)',
      }}
    >
      <header className="sticky top-0 z-50 border-b border-sky-200/70 bg-white/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-sky-500/30">
                <Palmtree size={20} strokeWidth={2.5} />
              </div>
              <h1 className="text-lg font-black tracking-tight">
                DOSM <span className="text-sky-500">Datathon 2026</span>
              </h1>
            </div>
            {last && (
              <div className="hidden md:flex items-center gap-6 pl-6 border-l border-sky-200">
                <div>
                  <p className="text-xl font-black leading-none">RM {last.revenue.toLocaleString()}M</p>
                  <p className="text-[11px] text-sky-700/70 mt-1">Tourism receipts, {last.year}</p>
                </div>
                <div>
                  <p className="text-xl font-black leading-none flex items-center gap-1.5">
                    {last.arrivals.toFixed(1)}M <Waves size={16} className="text-cyan-500" />
                  </p>
                  <p className="text-[11px] text-sky-700/70 mt-1">Arrivals, {last.year}</p>
                </div>
              </div>
            )}
          </div>

          <nav className="flex gap-2">
            {pills.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePage(p.id)}
                className={`px-5 py-2 text-sm font-bold rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  activePage === p.id
                    ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-transparent shadow-md shadow-sky-500/30'
                    : 'bg-white/70 text-sky-700 border-sky-200 hover:bg-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-8">
        {error ? (
          <GlassCard className="p-8">
            <h2 className="font-bold text-lg text-rose-600 mb-2">Couldn&apos;t load the Excel data</h2>
            <p className="text-sm text-sky-900">{error}</p>
          </GlassCard>
        ) : !data ? (
          <GlassCard className="p-8">
            <p className="text-sm font-semibold text-sky-700">Loading data from Excel…</p>
          </GlassCard>
        ) : activePage === 'blueprint' ? (
          <LangkawiBlueprint data={data} />
        ) : (
          <MLPolicySimulator data={data} />
        )}
      </main>
    </div>
  );
}