// Tier 3 of ml8.py: SARIMAX holdout backtest, seasonal-naive benchmark and monthly quota allocation.

import type { MonthlyRow } from './workbook';
import { mapePct } from './stats';
import { fitSarimax, forecastSarimax, type SarimaxParams } from './sarimax';

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MonthlyQuota {
  month: number;
  label: string;
  demandK: number;
  lowerK: number;
  upperK: number;
  weightPct: number;
  quotaK: number;
}

export interface BacktestPoint {
  label: string;
  actualK: number;
  sarimaxK: number;
  naiveK: number;
}

export interface ForecastResult {
  sheet: string;
  holdoutYear: number;
  forecastYear: number;
  backtest: {
    sarimaxMape: number;
    naiveMape: number;
    winner: 'sarimax' | 'naive';
    points: BacktestPoint[];
  } | null;
  params: SarimaxParams;
  quotas: MonthlyQuota[];
  peak: MonthlyQuota;
  trough: MonthlyQuota;
  /** Live check of the next year's first half against the forecast (only when those months exist). */
  telemetry: {
    months: number;
    actualK: number;
    projectedK: number;
    lowerK: number;
    upperK: number;
    inside: boolean;
  } | null;
}

const kSeries = (rows: MonthlyRow[]) => rows.map((r) => r.total / 1000);

export function buildForecast(monthly: MonthlyRow[], sheet: string, annualCapK: number): ForecastResult {
  // Latest year with all twelve months present = the last complete year (ml8 uses 2025).
  const counts = new Map<number, number>();
  for (const r of monthly) counts.set(r.year, (counts.get(r.year) ?? 0) + 1);
  const fullYears = [...counts.entries()].filter(([, c]) => c === 12).map(([y]) => y);
  if (!fullYears.length) throw new Error('The monthly sheet has no complete calendar year.');
  const holdoutYear = Math.max(...fullYears);
  const forecastYear = holdoutYear + 1;

  // 1. Out-of-sample holdout: train < holdoutYear, test = holdoutYear
  const trainRows = monthly.filter((r) => r.year < holdoutYear);
  const testRows = monthly.filter((r) => r.year === holdoutYear);
  let backtest: ForecastResult['backtest'] = null;
  if (trainRows.length >= 36 && testRows.length) {
    const train = kSeries(trainRows);
    const test = kSeries(testRows);
    const fit = fitSarimax(train);
    const preds = forecastSarimax(fit, testRows.length).mean;
    const naive = train.slice(-12).slice(0, testRows.length);
    const sarimaxMape = mapePct(test, preds);
    const naiveMape = mapePct(test, naive);
    backtest = {
      sarimaxMape,
      naiveMape,
      winner: sarimaxMape <= naiveMape ? 'sarimax' : 'naive',
      points: testRows.map((r, i) => ({
        label: MONTH_LABELS[r.month - 1],
        actualK: test[i],
        sarimaxK: preds[i],
        naiveK: naive[i],
      })),
    };
  }

  // 2. Operational forecast on the full series up to the last complete year
  const fullRows = monthly.filter((r) => r.year <= holdoutYear);
  const fit = fitSarimax(kSeries(fullRows));
  const fc = forecastSarimax(fit, 12);
  const totalDemand = fc.mean.reduce((s, v) => s + v, 0);

  // 3. Quota allocation: the forecast's seasonal shape distributes the annual cap
  const quotas: MonthlyQuota[] = fc.mean.map((demand, i) => {
    const weight = demand / totalDemand;
    return {
      month: i + 1,
      label: MONTH_LABELS[i],
      demandK: demand,
      lowerK: fc.lower[i],
      upperK: fc.upper[i],
      weightPct: weight * 100,
      quotaK: annualCapK * weight,
    };
  });
  const peak = quotas.reduce((a, b) => (b.quotaK > a.quotaK ? b : a));
  const trough = quotas.reduce((a, b) => (b.quotaK < a.quotaK ? b : a));

  // 4. Optional live H1 telemetry for the forecast year
  const live = monthly.filter((r) => r.year === forecastYear && r.month <= 6);
  let telemetry: ForecastResult['telemetry'] = null;
  if (live.length) {
    const n = live.length;
    const actualK = live.reduce((s, r) => s + r.total / 1000, 0);
    const projectedK = fc.mean.slice(0, n).reduce((s, v) => s + v, 0);
    const lowerK = fc.lower.slice(0, n).reduce((s, v) => s + v, 0);
    const upperK = fc.upper.slice(0, n).reduce((s, v) => s + v, 0);
    telemetry = { months: n, actualK, projectedK, lowerK, upperK, inside: actualK >= lowerK && actualK <= upperK };
  }

  return {
    sheet,
    holdoutYear,
    forecastYear,
    backtest,
    params: { phi: fit.phi, Phi: fit.Phi, theta: fit.theta, sigma2: fit.sigma2 },
    quotas,
    peak,
    trough,
    telemetry,
  };
}
