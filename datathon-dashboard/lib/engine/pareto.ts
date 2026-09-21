// Tier 2 of ml8.py: scenario-based stochastic Pareto search (50,000 volume x ALOS combinations).

import { MT19937 } from './rng';
import { clip, maxOf, minOf } from './stats';
import { predictLcc, type MarineModel } from './marine';
import type { IslandProfile, IslandYear } from './workbook';

export const N_SEARCH = 50_000;
const SEED = 42;
const WASTE_KG_PER_VISITOR_NIGHT = 1.17;
const SCATTER_TARGET = 3000;

/** Search ranges from ml8.py: volume as a multiple of peak arrivals, ALOS as a multiple of current ALOS. */
export const SEARCH_BOUNDS = { volLo: 0.3, volHi: 1.5, alosLo: 0.7, alosHi: 1.2 } as const;

export type ScenarioKey = 'optimal' | 'current' | 'crisis';

export const SCENARIOS: { key: ScenarioKey; label: string; short: string; factor: number }[] = [
  { key: 'optimal', label: 'Optimal (Low Disturbance)', short: 'Optimal', factor: 0.5 },
  { key: 'current', label: 'Current (Baseline Disturbance)', short: 'Current', factor: 1 },
  { key: 'crisis', label: 'Crisis (High Disturbance / COTS)', short: 'Crisis', factor: 1.5 },
];

export interface DnaWeights {
  marine: number;
  retail: number;
  eco: number;
}

/** Scenario-independent part of the search: the random draws and the pillars that don't depend on marine health. */
export interface ParetoSetup {
  island: string;
  proxyReef: string;
  weights: DnaWeights;
  wasteLimitTons: number;
  maxVolK: number;
  peakYear: number;
  currentAlos: number;
  meanDisturbance: number;
  maxLcc: number;
  vols: Float64Array;
  alos: Float64Array;
  yieldK: Float64Array;
  hRetail: Float64Array;
  hEco: Float64Array;
  yMin: number;
  yMax: number;
}

export interface ScatterPoint {
  yieldK: number; // thousand visitor-nights
  ehi: number; // 0-1
  knee?: boolean;
}

export interface ScenarioResult {
  key: ScenarioKey;
  label: string;
  short: string;
  disturbance: number;
  predictedLcc: number;
  hMarine: number;
  capK: number;
  alos: number;
  ehi: number;
  ehiMax: number;
  capVsPeakPct: number;
  alosVsCurrentPct: number;
  /** Extension to ml8: largest simulated volume whose EHI is at least the Current-scenario knee EHI. */
  sustainableCeilingK: number | null;
  scatter: ScatterPoint[];
}

export function prepareSearch(
  profile: IslandProfile,
  years: IslandYear[],
  marine: MarineModel,
  proxyReef: string,
  wasteLimitTons: number,
): ParetoSetup {
  // 1. DNA weights: L1-normalised room mix
  const total = profile.beachRooms + profile.cityRooms + profile.ecoRooms;
  const weights: DnaWeights = {
    marine: profile.beachRooms / total,
    retail: profile.cityRooms / total,
    eco: profile.ecoRooms / total,
  };

  // 2. Base parameters
  const withVisitors = years.filter((y) => y.visitorsK !== null) as (IslandYear & { visitorsK: number })[];
  if (!withVisitors.length) throw new Error(`No visitor data found for ${profile.island}.`);
  const peak = withVisitors.reduce((a, b) => (b.visitorsK > a.visitorsK ? b : a));
  const maxVolK = peak.visitorsK;
  const currentAlos = profile.currentAlos;

  const reef = marine.rows.filter((r) => r.island === proxyReef);
  if (!reef.length) throw new Error(`Proxy reef "${proxyReef}" has no complete rows in Coral_Reef_Status.`);
  const meanDisturbance = reef.reduce((s, r) => s + r.disturbance, 0) / reef.length;
  const maxLcc = maxOf(reef.map((r) => r.lcc));

  // 3. Stochastic engine (np.random.seed(42): volumes first, then ALOS)
  const rng = new MT19937(SEED);
  const vols = rng.uniform(maxVolK * SEARCH_BOUNDS.volLo, maxVolK * SEARCH_BOUNDS.volHi, N_SEARCH);
  const alos = rng.uniform(currentAlos * SEARCH_BOUNDS.alosLo, currentAlos * SEARCH_BOUNDS.alosHi, N_SEARCH);

  const yieldK = new Float64Array(N_SEARCH);
  const hRetail = new Float64Array(N_SEARCH);
  const hEco = new Float64Array(N_SEARCH);
  for (let i = 0; i < N_SEARCH; i++) {
    yieldK[i] = vols[i] * alos[i];
    const waste = vols[i] * alos[i] * WASTE_KG_PER_VISITOR_NIGHT;
    hRetail[i] = clip(1 - (waste / wasteLimitTons) ** 2, 0, 1);
    hEco[i] = clip(1 - (vols[i] / maxVolK) ** 2.5, 0, 1);
  }

  return {
    island: profile.island,
    proxyReef,
    weights,
    wasteLimitTons,
    maxVolK,
    peakYear: peak.year,
    currentAlos,
    meanDisturbance,
    maxLcc,
    vols,
    alos,
    yieldK,
    hRetail,
    hEco,
    yMin: minOf(yieldK),
    yMax: maxOf(yieldK),
  };
}

interface Core {
  disturbance: number;
  predictedLcc: number;
  hMarine: number;
  ehi: Float64Array;
  ehiMin: number;
  ehiMax: number;
  best: number;
}

function core(setup: ParetoSetup, marine: MarineModel, key: ScenarioKey): Core {
  const sc = SCENARIOS.find((s) => s.key === key)!;
  const disturbance = setup.meanDisturbance * sc.factor;
  const predictedLcc = predictLcc(marine, disturbance, setup.proxyReef);
  const hMarine = clip(predictedLcc / setup.maxLcc, 0, 1);
  const { marine: wm, retail: wr, eco: we } = setup.weights;

  const ehi = new Float64Array(N_SEARCH);
  for (let i = 0; i < N_SEARCH; i++) ehi[i] = wm * hMarine + wr * setup.hRetail[i] + we * setup.hEco[i];
  const ehiMin = minOf(ehi);
  const ehiMax = maxOf(ehi);

  // Utopia point: nearest to (1, 1) after min-max normalising both objectives.
  const yRange = setup.yMax - setup.yMin;
  const eRange = ehiMax - ehiMin;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < N_SEARCH; i++) {
    const ny = (setup.yieldK[i] - setup.yMin) / yRange - 1;
    const ne = (ehi[i] - ehiMin) / eRange - 1;
    const d = Math.sqrt(ny * ny + ne * ne);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { disturbance, predictedLcc, hMarine, ehi, ehiMin, ehiMax, best };
}

/** Runs the full 50,000-scenario search for one disturbance scenario. */
export function runScenario(setup: ParetoSetup, marine: MarineModel, key: ScenarioKey): ScenarioResult {
  const c = core(setup, marine, key);
  const ref = key === 'current' ? c : core(setup, marine, 'current');
  const refEhi = ref.ehi[ref.best];

  let ceiling = -Infinity;
  for (let i = 0; i < N_SEARCH; i++) if (c.ehi[i] >= refEhi - 1e-12 && setup.vols[i] > ceiling) ceiling = setup.vols[i];

  const stride = Math.max(1, Math.floor(N_SEARCH / SCATTER_TARGET));
  const scatter: ScatterPoint[] = [];
  for (let i = 0; i < N_SEARCH; i += stride) scatter.push({ yieldK: setup.yieldK[i], ehi: c.ehi[i] });
  scatter.push({ yieldK: setup.yieldK[c.best], ehi: c.ehi[c.best], knee: true });

  const meta = SCENARIOS.find((s) => s.key === key)!;
  return {
    key,
    label: meta.label,
    short: meta.short,
    disturbance: c.disturbance,
    predictedLcc: c.predictedLcc,
    hMarine: c.hMarine,
    capK: setup.vols[c.best],
    alos: setup.alos[c.best],
    ehi: c.ehi[c.best],
    ehiMax: c.ehiMax,
    capVsPeakPct: (setup.vols[c.best] / setup.maxVolK - 1) * 100,
    alosVsCurrentPct: (setup.alos[c.best] / setup.currentAlos - 1) * 100,
    sustainableCeilingK: Number.isFinite(ceiling) ? ceiling : null,
    scatter,
  };
}

export function runAllScenarios(setup: ParetoSetup, marine: MarineModel): Record<ScenarioKey, ScenarioResult> {
  return {
    optimal: runScenario(setup, marine, 'optimal'),
    current: runScenario(setup, marine, 'current'),
    crisis: runScenario(setup, marine, 'crisis'),
  };
}
