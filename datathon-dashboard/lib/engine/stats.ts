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

// ---------------------------------------------------------------------------
// Classical inference (replaces scipy.stats / statsmodels pieces used by the analysis notebook)
// ---------------------------------------------------------------------------

/** Population standard deviation (numpy.std, ddof = 0). */
export function stdPop(a: ArrayLike<number>): number {
  const m = mean(a);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2;
  return Math.sqrt(s / a.length);
}

/** Sample variance (ddof = 1). */
export function varSample(a: ArrayLike<number>): number {
  const m = mean(a);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2;
  return s / (a.length - 1);
}

// Lanczos approximation (g = 7, n = 9)
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

function lnGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  const x = z - 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const TINY = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b). */
function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-sided p-value of Student's t statistic with `df` degrees of freedom. */
export function studentTTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t) || !(df > 0)) return NaN;
  return betaInc(df / (df + t * t), df / 2, 0.5);
}

/** Two-sided critical value: the t with P(|T| > t) = 1 − level (scipy.stats.t.ppf((1 + level) / 2, df)). */
export function studentTCritical(df: number, level = 0.95): number {
  const target = 1 - level;
  let lo = 0;
  let hi = 1e4;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTTwoSidedP(mid, df) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Pearson correlation coefficient. */
export function pearsonR(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

export interface OlsInference {
  n: number;
  slope: number;
  intercept: number;
  r: number;
  r2: number;
  /** Two-sided p-value of the slope (equals the Pearson correlation p-value). */
  p: number;
  /** Fitted value and 95% confidence interval of the mean response at x. */
  predict: (x: number) => { fit: number; lo: number; hi: number };
}

/** Simple OLS with Pearson r, p-value and the 95% confidence band of the fitted line. Needs n >= 3. */
export function olsInference(xs: number[], ys: number[]): OlsInference | null {
  const n = xs.length;
  if (n < 3 || n !== ys.length) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (intercept + slope * xs[i])) ** 2;
  const df = n - 2;
  const r = pearsonR(xs, ys);
  const p = Math.abs(r) >= 1 ? 0 : studentTTwoSidedP((r * Math.sqrt(df)) / Math.sqrt(1 - r * r), df);
  const s = Math.sqrt(sse / df);
  const tCrit = studentTCritical(df, 0.95);
  return {
    n, slope, intercept, r, r2: r * r, p,
    predict: (x) => {
      const fit = intercept + slope * x;
      const half = tCrit * s * Math.sqrt(1 / n + (x - mx) ** 2 / sxx);
      return { fit, lo: fit - half, hi: fit + half };
    },
  };
}

export interface WelchResult {
  mean1: number;
  mean2: number;
  n1: number;
  n2: number;
  t: number;
  df: number;
  p: number;
}

/** Welch's unequal-variance t-test (scipy.stats.ttest_ind(a, b, equal_var=False)). */
export function welchTTest(a: number[], b: number[]): WelchResult | null {
  if (a.length < 2 || b.length < 2) return null;
  const v1 = varSample(a) / a.length;
  const v2 = varSample(b) / b.length;
  if (!(v1 + v2 > 0)) return null;
  const t = (mean(a) - mean(b)) / Math.sqrt(v1 + v2);
  const df = (v1 + v2) ** 2 / (v1 ** 2 / (a.length - 1) + v2 ** 2 / (b.length - 1));
  return { mean1: mean(a), mean2: mean(b), n1: a.length, n2: b.length, t, df, p: studentTTwoSidedP(t, df) };
}
