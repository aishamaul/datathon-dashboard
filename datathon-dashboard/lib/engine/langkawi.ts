// Descriptive analyses behind the Langkawi page, ported from the analysis notebook (analysis_final.pdf):
// arrivals trend, revenue regressions, the policy-catalyst t-test and coral net change.
// Every figure is computed from the workbooks at runtime.

import * as XLSX from 'xlsx';
import { ISLAND_CONFIG, toNum, type WorkbookData } from './workbook';
import { maxOf, mean, minOf, olsInference, stdPop, welchTTest, type WelchResult } from './stats';

// ---------------------------------------------------------------------------
// Inputs that live in the notebook rather than in a workbook
// ---------------------------------------------------------------------------

/** Extra workbook (the notebook's data_cleaned.xlsx) holding the GDP and employment history. */
export const HISTORY_SHEETS = { gdp: 'GDP', employment: 'LANGKAWI EMPLOYMENT & LABOUR' } as const;

/**
 * The notebook's `historical_receipts` patch: tourism receipts (RM million) for the years before the
 * workbook's receipts series starts (2019). A workbook value always wins when a year exists in both.
 */
export const NOTEBOOK_HISTORICAL_RECEIPTS_RM_MIL: Readonly<Record<number, number>> = {
  2015: 3800,
  2016: 4250,
  2017: 5600,
  2018: 5800,
};

/** Policy interventions marked on the timelines (names and years from the notebook). */
export const POLICY_MILESTONES = [
  { year: 2020, label: 'HELANG Roadmap', short: 'HELANG' },
  { year: 2021, label: '1T1T Conservation', short: '1T1T' },
  { year: 2024, label: 'LUGGp Blueprint', short: 'LUGGp' },
] as const;

/** The notebook's t-test compares stays before vs from the LUGGp Blueprint year. */
export const BLUEPRINT_YEAR = 2024;

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------------------------------------------------------------------
// History workbook
// ---------------------------------------------------------------------------

export interface HistoryData {
  services: Map<number, number>;
  unemployment: Map<number, number>;
}

/** Reads the optional GDP and employment sheets; a missing sheet simply yields no rows. */
export function readHistory(wb: XLSX.WorkBook): HistoryData {
  const pick = (sheet: string, col: string) => {
    const out = new Map<number, number>();
    const ws = wb.Sheets[sheet];
    if (!ws) return out;
    for (const r of XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })) {
      const year = toNum(r['Year']);
      const value = toNum(r[col]);
      if (year !== null && value !== null) out.set(year, value);
    }
    return out;
  };
  return {
    services: pick(HISTORY_SHEETS.gdp, 'Services'),
    unemployment: pick(HISTORY_SHEETS.employment, 'Unemployment_Rate_pct'),
  };
}

// ---------------------------------------------------------------------------
// Arrivals trend (yearly overview and monthly breakdown)
// ---------------------------------------------------------------------------

export interface YearlyArrival {
  year: number;
  /** Tourist arrivals, millions. */
  arrivalsM: number;
  /** Tourism receipts, RM million. */
  receiptsM: number | null;
}

export interface MonthlyArrival {
  month: number;
  label: string;
  total: number;
  international: number | null;
}

export interface ArrivalsData {
  yearly: YearlyArrival[];
  monthlyByYear: Record<number, MonthlyArrival[]>;
  /** Years that have monthly data, newest first. */
  monthlyYears: number[];
}

function buildArrivals(data: WorkbookData): ArrivalsData {
  const yearly = data.socio
    .filter((r) => r.visitorsK !== null)
    .map<YearlyArrival>((r) => ({
      year: r.year,
      arrivalsM: Math.round((r.visitorsK as number) / 10) / 100,
      receiptsM: r.receiptsM,
    }))
    .sort((a, b) => a.year - b.year);

  const monthlyByYear: Record<number, MonthlyArrival[]> = {};
  for (const m of data.monthly) {
    (monthlyByYear[m.year] ??= []).push({
      month: m.month,
      label: MONTH_LABELS[m.month - 1],
      total: m.total,
      international: m.international,
    });
  }
  for (const rows of Object.values(monthlyByYear)) rows.sort((a, b) => a.month - b.month);
  const monthlyYears = Object.keys(monthlyByYear).map(Number).sort((a, b) => b - a);
  return { yearly, monthlyByYear, monthlyYears };
}

// ---------------------------------------------------------------------------
// Revenue regressions (economic engine, grassroots impact)
// ---------------------------------------------------------------------------

export interface RegressionPoint {
  year: number;
  x: number;
  y: number;
}

export interface RegressionBandPoint {
  x: number;
  fit: number;
  lo: number;
  hi: number;
  range: [number, number];
}

export interface RegressionChart {
  points: RegressionPoint[];
  n: number;
  r: number;
  r2: number;
  p: number;
  slope: number;
  intercept: number;
  band: RegressionBandPoint[];
  firstYear: number;
  lastYear: number;
}

export interface EconomyResult {
  /** Tourism receipts vs services-sector GDP. */
  gdp: RegressionChart | null;
  /** Tourism receipts vs unemployment rate. */
  unemployment: RegressionChart | null;
  /** False when the GDP/employment history workbook could not be loaded. */
  historyLoaded: boolean;
}

const BAND_STEPS = 60;

function buildRegression(receipts: Map<number, number>, series: Map<number, number>): RegressionChart | null {
  const points = [...series.entries()]
    .filter(([year]) => receipts.has(year))
    .map<RegressionPoint>(([year, y]) => ({ year, x: receipts.get(year) as number, y }))
    .sort((a, b) => a.year - b.year);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const model = olsInference(xs, ys);
  if (!model) return null;
  const lo = minOf(xs);
  const hi = maxOf(xs);
  const band = Array.from({ length: BAND_STEPS + 1 }, (_, i) => {
    const x = lo + ((hi - lo) * i) / BAND_STEPS;
    const b = model.predict(x);
    return { x, fit: b.fit, lo: b.lo, hi: b.hi, range: [b.lo, b.hi] as [number, number] };
  });
  return {
    points, n: model.n, r: model.r, r2: model.r2, p: model.p, slope: model.slope, intercept: model.intercept,
    band, firstYear: points[0].year, lastYear: points[points.length - 1].year,
  };
}

function buildEconomy(data: WorkbookData, history: HistoryData | null): EconomyResult {
  const receipts = new Map<number, number>(
    Object.entries(NOTEBOOK_HISTORICAL_RECEIPTS_RM_MIL).map(([year, value]) => [Number(year), value]),
  );
  for (const r of data.socio) if (r.receiptsM !== null) receipts.set(r.year, r.receiptsM);

  // History workbook first, then any value present in the main workbook wins.
  const services = new Map<number, number>(history?.services ?? []);
  const unemployment = new Map<number, number>(history?.unemployment ?? []);
  for (const r of data.socio) {
    if (r.services !== null) services.set(r.year, r.services);
    if (r.unemploymentPct !== null) unemployment.set(r.year, r.unemploymentPct);
  }
  return {
    gdp: buildRegression(receipts, services),
    unemployment: buildRegression(receipts, unemployment),
    historyLoaded: history !== null,
  };
}

// ---------------------------------------------------------------------------
// Policy catalyst: length of stay around the LUGGp Blueprint
// ---------------------------------------------------------------------------

export interface CatalystResult {
  points: { year: number; alos: number }[];
  /** Milestones whose year appears in the series (as in the notebook). */
  milestones: { year: number; label: string; short: string }[];
  blueprintYear: number;
  /** Welch t-test of ALOS before vs from the blueprint year. */
  test: (WelchResult & { preFrom: number; preTo: number; postFrom: number; postTo: number }) | null;
}

function buildCatalyst(data: WorkbookData): CatalystResult | null {
  const points = data.socio
    .filter((r) => r.alos !== null)
    .map((r) => ({ year: r.year, alos: r.alos as number }))
    .sort((a, b) => a.year - b.year);
  if (points.length < 2) return null;
  const years = new Set(points.map((p) => p.year));
  const pre = points.filter((p) => p.year < BLUEPRINT_YEAR);
  const post = points.filter((p) => p.year >= BLUEPRINT_YEAR);
  const t = welchTTest(pre.map((p) => p.alos), post.map((p) => p.alos));
  return {
    points,
    milestones: POLICY_MILESTONES.filter((m) => years.has(m.year)).map((m) => ({ ...m })),
    blueprintYear: BLUEPRINT_YEAR,
    test: t
      ? {
          ...t,
          preFrom: pre[0].year, preTo: pre[pre.length - 1].year,
          postFrom: post[0].year, postTo: post[post.length - 1].year,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Coral net change (environmental resilience)
// ---------------------------------------------------------------------------

export interface CoralChangeBar {
  island: string;
  short: string;
  /** Net change in live coral cover, percentage points (last survey minus first). */
  changePct: number;
  isProxy: boolean;
}

export interface CoralChangeResult {
  bars: CoralChangeBar[];
  mean: number;
  std: number;
  /** The Langkawi proxy reef (Pulau Payar) against the island average, in standard deviations. */
  proxy: { island: string; changePct: number; z: number } | null;
  firstYear: number;
  lastYear: number;
}

function buildCoralChange(data: WorkbookData): CoralChangeResult | null {
  const byIsland = new Map<string, { year: number; lcc: number }[]>();
  for (const r of data.coral) {
    if (r.lcc === null) continue;
    const rows = byIsland.get(r.island) ?? [];
    rows.push({ year: r.year, lcc: r.lcc });
    byIsland.set(r.island, rows);
  }
  const proxyReef: string = ISLAND_CONFIG.Langkawi.proxyReef;
  const bars: CoralChangeBar[] = [];
  const years: number[] = [];
  for (const island of [...byIsland.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const rows = (byIsland.get(island) as { year: number; lcc: number }[]).sort((a, b) => a.year - b.year);
    if (rows.length < 2) continue;
    const net = rows[rows.length - 1].lcc - rows[0].lcc;
    bars.push({
      island,
      short: island.replace(/^Pulau\s+/i, ''),
      changePct: Math.round(net * 100 * 100) / 100,
      isProxy: island === proxyReef,
    });
    years.push(rows[0].year, rows[rows.length - 1].year);
  }
  if (bars.length === 0) return null;
  const values = bars.map((b) => b.changePct);
  const avg = mean(values);
  const sd = stdPop(values);
  const proxy = bars.find((b) => b.isProxy);
  return {
    bars,
    mean: avg,
    std: sd,
    proxy: proxy ? { island: proxy.island, changePct: proxy.changePct, z: (proxy.changePct - avg) / (sd !== 0 ? sd : 1) } : null,
    firstYear: minOf(years),
    lastYear: maxOf(years),
  };
}

// ---------------------------------------------------------------------------

export interface LangkawiInsights {
  arrivals: ArrivalsData;
  economy: EconomyResult;
  catalyst: CatalystResult | null;
  coralChange: CoralChangeResult | null;
}

export function buildLangkawiInsights(data: WorkbookData, history: HistoryData | null): LangkawiInsights {
  return {
    arrivals: buildArrivals(data),
    economy: buildEconomy(data, history),
    catalyst: buildCatalyst(data),
    coralChange: buildCoralChange(data),
  };
}
