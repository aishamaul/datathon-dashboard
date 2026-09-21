// Orchestrates the whole ml8.py pipeline plus the descriptive series behind the Langkawi charts.

import { ISLAND_CONFIG, ISLAND_KEYS, readWorkbook, type IslandKey, type WorkbookData } from './workbook';
import { trainPooledMarineModel, type MarineModel } from './marine';
import { prepareSearch, runAllScenarios, type ParetoSetup, type ScenarioKey, type ScenarioResult } from './pareto';
import { buildForecast, type ForecastResult } from './forecast';
import type * as XLSX from 'xlsx';

export interface IslandAnalysis {
  key: IslandKey;
  setup: ParetoSetup;
  scenarios: Record<ScenarioKey, ScenarioResult>;
}

export interface YieldTrapPoint {
  year: number;
  alosIndex: number;
  yieldIndex: number;
  alos: number;
  yieldPerNightRM: number;
}

export interface DecouplingPoint {
  year: number;
  value: number;
}

export interface Analysis {
  data: WorkbookData;
  marine: MarineModel;
  islands: Record<IslandKey, IslandAnalysis>;
  forecast: ForecastResult | null;
  forecastError: string | null;
  yieldTrap: {
    points: YieldTrapPoint[];
    alosChangePct: number;
    yieldChangePct: number;
  } | null;
  decoupling: {
    points: DecouplingPoint[];
    peakYear: number;
    peakValue: number;
    latestYear: number;
    latestValue: number;
    changeFromPeakPct: number;
  } | null;
}

export function buildAnalysis(wb: XLSX.WorkBook): Analysis {
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

  // 1A: ALOS vs yield per night (receipts per trip / ALOS), both indexed to the first year
  const yt = data.socio
    .filter((r) => r.alos !== null && r.receiptsPerTripRM !== null)
    .sort((a, b) => a.year - b.year)
    .map((r) => ({ year: r.year, alos: r.alos as number, yieldPerNightRM: (r.receiptsPerTripRM as number) / (r.alos as number) }));
  const yieldTrap = yt.length >= 2
    ? {
        points: yt.map<YieldTrapPoint>((p) => ({
          ...p,
          alosIndex: (p.alos / yt[0].alos) * 100,
          yieldIndex: (p.yieldPerNightRM / yt[0].yieldPerNightRM) * 100,
        })),
        alosChangePct: (yt[yt.length - 1].alos / yt[0].alos - 1) * 100,
        yieldChangePct: (yt[yt.length - 1].yieldPerNightRM / yt[0].yieldPerNightRM - 1) * 100,
      }
    : null;

  // 1B: Decoupling index (RM of receipts per tonne of waste)
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

  return { data, marine, islands, forecast, forecastError, yieldTrap, decoupling };
}
