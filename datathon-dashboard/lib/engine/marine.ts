// Tier 1 of ml8.py: pooled Ridge regression  LCC ~ Disturbance + island fixed effects.

import type { CoralRow } from './workbook';
import { fitRidgeCV, looMae, meanBaselineMae, r2Score, type RidgeModel } from './stats';

export const RIDGE_ALPHAS = [0.001, 0.01, 0.1, 1.0, 10.0];
export const RIDGE_CV_FOLDS = 5;

export interface MarineModel {
  model: RidgeModel;
  /** Islands with a fixed-effect dummy (pandas get_dummies(drop_first=True)). */
  feIslands: string[];
  /** Islands in the panel, alphabetical. */
  allIslands: string[];
  rows: { year: number; island: string; disturbance: number; lcc: number; fitted: number }[];
  r2: number;
  alpha: number;
  disturbanceCoef: number;
  looMae: number;
  baselineMae: number;
  /** 1 − LOO MAE / baseline MAE, in percent. */
  skillPct: number;
}

const featureRow = (disturbance: number, island: string, feIslands: string[]) => [
  disturbance,
  ...feIslands.map((f) => (f === island ? 1 : 0)),
];

export function trainPooledMarineModel(coral: CoralRow[]): MarineModel {
  const clean = coral.filter((r) => r.lcc !== null && r.disturbance !== null) as (CoralRow & {
    lcc: number;
    disturbance: number;
  })[];
  if (clean.length < 5) throw new Error('Coral_Reef_Status has too few complete rows to fit the marine model.');

  const allIslands = [...new Set(clean.map((r) => r.island))].sort();
  const feIslands = allIslands.slice(1); // drop_first
  const X = clean.map((r) => featureRow(r.disturbance, r.island, feIslands));
  const y = clean.map((r) => r.lcc);

  const model = fitRidgeCV(X, y, RIDGE_ALPHAS, RIDGE_CV_FOLDS);
  const fitted = X.map((x) => model.predict(x));
  const loo = looMae(X, y, model.alpha);
  const base = meanBaselineMae(y);

  return {
    model,
    feIslands,
    allIslands,
    rows: clean.map((r, i) => ({ year: r.year, island: r.island, disturbance: r.disturbance, lcc: r.lcc, fitted: fitted[i] })),
    r2: r2Score(y, fitted),
    alpha: model.alpha,
    disturbanceCoef: model.coef[0],
    looMae: loo,
    baselineMae: base,
    skillPct: (1 - loo / base) * 100,
  };
}

/** Predicted live coral cover (fraction) for a given disturbance level on a given reef. */
export function predictLcc(m: MarineModel, disturbance: number, island: string): number {
  return m.model.predict(featureRow(disturbance, island, m.feIslands));
}
