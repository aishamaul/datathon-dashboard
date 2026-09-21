// Orchestrates the whole ml8.py pipeline plus the descriptive series behind the Langkawi charts.

import { ISLAND_CONFIG, ISLAND_KEYS, readWorkbook, type IslandKey, type WorkbookData } from './workbook';
import { trainPooledMarineModel, type MarineModel } from './marine';
import { prepareSearch, runAllScenarios, type ParetoSetup, type ScenarioKey, type ScenarioResult } from './pareto';
import { buildForecast, type ForecastResult } from './forecast';
import { buildLangkawiInsights, readHistory, type LangkawiInsights } from './langkawi';
import type * as XLSX from 'xlsx';

export interface IslandAnalysis {
  key: IslandKey;
  setup: ParetoSetup;
  scenarios: Record<ScenarioKey, ScenarioResult>;
}

export interface DecouplingPoint {
  year: number;
  value: number;
}

export interface Analysis extends LangkawiInsights {
  data: WorkbookData;
  marine: MarineModel;
  islands: Record<IslandKey, IslandAnalysis>;
  forecast: ForecastResult | null;
  forecastError: string | null;
  decoupling: {
    points: DecouplingPoint[];
    peakYear: number;
    peakValue: number;
    latestYear: number;
    latestValue: number;
    changeFromPeakPct: number;
  } | null;
}

/**
 * `historyWb` is the optional GDP / employment history workbook (the notebook's data_cleaned.xlsx);
 * without it the two revenue regressions fall back to whatever years data_new.xlsx itself provides.
 */
export function buildAnalysis(wb: XLSX.WorkBook, historyWb: XLSX.WorkBook | null = null): Analysis {
  const data = readWorkbook(wb);
  const marine = trainPooledMarineModel(data.coral);

  const islands = {} as Record<IslandKey, IslandAnalysis>;
  for (const key of ISLAND_KEYS) {
    const profile = data.profiles.find((p) => p.island === key);
    if (!profile) throw new Error(`Island_Profiles has no row for "${key}".`);
    const cfg = ISLAND_CONFIG[key];
    const setup = prepareSearch(profile, data.islandYears[key], marine, cfg.proxyReef, profile.wasteLimitOverride ?? cfg.wasteLimitTons);
    islands[key] = { key, setup, scenarios: runAllScenarios(setup, marine) };
  }

  // Tier 3 only runs for Langkawi, using the Current-scenario cap (as in ml8.py)
  let forecast: ForecastResult | null = null;
  let forecastError: string | null = null;
  try {
    forecast = buildForecast(data.monthly, data.monthlySheetName, islands.Langkawi.scenarios.current.capK);
  } catch (e) {
    forecastError = e instanceof Error ? e.message : String(e);
  }

  // Decoupling index (RM of receipts per tonne of waste)
  const dp = data.socio
    .filter((r) => r.decoupling !== null)
    .sort((a, b) => a.year - b.year)
    .map<DecouplingPoint>((r) => ({ year: r.year, value: r.decoupling as number }));
  let decoupling: Analysis['decoupling'] = null;
  if (dp.length >= 2) {
    const peak = dp.reduce((a, b) => (b.value > a.value ? b : a));
    const latest = dp[dp.length - 1];
    decoupling = {
      points: dp,
      peakYear: peak.year,
      peakValue: peak.value,
      latestYear: latest.year,
      latestValue: latest.value,
      changeFromPeakPct: (latest.value / peak.value - 1) * 100,
    };
  }

  const insights = buildLangkawiInsights(data, historyWb ? readHistory(historyWb) : null);

  return { data, marine, islands, forecast, forecastError, decoupling, ...insights };
}
