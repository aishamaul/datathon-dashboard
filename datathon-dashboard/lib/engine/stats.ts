// Small numeric toolkit (replaces numpy / sklearn pieces that ml8.py relies on).

export const mean = (a: ArrayLike<number>): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
};

export const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function minOf(a: ArrayLike<number>): number {
  let m = Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] < m) m = a[i];
  return m;
}

export function maxOf(a: ArrayLike<number>): number {
  let m = -Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
  return m;
}

/** Gaussian elimination with partial pivoting (small dense systems only). */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / M[i][i];
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c];
    x[i] = s / M[i][i];
  }
  return x;
}

export interface RidgeModel {
  coef: number[];
  intercept: number;
  alpha: number;
  predict: (x: number[]) => number;
}

/** sklearn `Ridge(alpha, fit_intercept=True)`: centre X and y, solve (XcᵀXc + αI)w = Xcᵀyc. */
export function fitRidge(X: number[][], y: number[], alpha: number): RidgeModel {
  const n = X.length;
  const p = X[0].length;
  const mx = Array.from({ length: p }, (_, j) => mean(X.map((r) => r[j])));
  const my = mean(y);
  const A = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const b = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      const xj = X[i][j] - mx[j];
      b[j] += xj * (y[i] - my);
      for (let k = 0; k < p; k++) A[j][k] += xj * (X[i][k] - mx[k]);
    }
  }
  for (let j = 0; j < p; j++) A[j][j] += alpha;
  const coef = solveLinear(A, b);
  const intercept = my - coef.reduce((s, w, j) => s + w * mx[j], 0);
  return {
    coef,
    intercept,
    alpha,
    predict: (x) => intercept + x.reduce((s, v, j) => s + v * coef[j], 0),
  };
}

export function r2Score(y: number[], yhat: number[]): number {
  const m = mean(y);
  let ssr = 0;
  let sst = 0;
  for (let i = 0; i < y.length; i++) {
    ssr += (y[i] - yhat[i]) ** 2;
    sst += (y[i] - m) ** 2;
  }
  return 1 - ssr / sst;
}

/** sklearn KFold(n_splits, shuffle=False): contiguous folds, first (n % k) folds one larger. */
export function kFoldIndices(n: number, k: number): number[][] {
  const folds: number[][] = [];
  let start = 0;
  for (let i = 0; i < k; i++) {
    const size = Math.floor(n / k) + (i < n % k ? 1 : 0);
    folds.push(Array.from({ length: size }, (_, j) => start + j));
    start += size;
  }
  return folds;
}

/**
 * sklearn `RidgeCV(alphas, cv=k)`: each alpha is scored by the mean per-fold R² on the
 * held-out fold (GridSearchCV default scoring); the first best alpha wins; refit on all rows.
 */
export function fitRidgeCV(X: number[][], y: number[], alphas: number[], k: number): RidgeModel {
  const n = X.length;
  const folds = kFoldIndices(n, k);
  const scores = alphas.map((a) =>
    mean(
      folds.map((test) => {
        const inTest = new Set(test);
        const train = Array.from({ length: n }, (_, i) => i).filter((i) => !inTest.has(i));
        const m = fitRidge(train.map((i) => X[i]), train.map((i) => y[i]), a);
        return r2Score(test.map((i) => y[i]), test.map((i) => m.predict(X[i])));
      }),
    ),
  );
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  return fitRidge(X, y, alphas[best]);
}

/** Leave-one-out MAE of a ridge model with fixed alpha. */
export function looMae(X: number[][], y: number[], alpha: number): number {
  const n = X.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const train = Array.from({ length: n }, (_, j) => j).filter((j) => j !== i);
    const m = fitRidge(train.map((j) => X[j]), train.map((j) => y[j]), alpha);
    s += Math.abs(y[i] - m.predict(X[i]));
  }
  return s / n;
}

/** MAE of always predicting the mean of y (the "no-skill" baseline). */
export function meanBaselineMae(y: number[]): number {
  const m = mean(y);
  return mean(y.map((v) => Math.abs(v - m)));
}

/** Mean absolute percentage error, in percent (sklearn's MAPE x 100). */
export function mapePct(actual: ArrayLike<number>, pred: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < actual.length; i++) s += Math.abs(actual[i] - pred[i]) / Math.abs(actual[i]);
  return (s / actual.length) * 100;
}

/** Simple OLS y = a + b·x with R². */
export function olsLine(xs: number[], ys: number[]) {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  return { slope, intercept, r2: r2Score(ys, xs.map((x) => intercept + slope * x)) };
}
