// TypeScript SARIMAX(1,1,1)(1,1,0,12) — a browser-side stand-in for statsmodels' SARIMAX
// as used in ml8.py (enforce_stationarity=False, no trend, no exog).
//
// Model:  (1 − φB)(1 − ΦB¹²)(1 − B)(1 − B¹²) y_t = (1 + θB) ε_t
// Estimation: exact Gaussian likelihood of the differenced series via a Kalman filter on the
// ARMA(13,1) state-space form, with the scale concentrated out; Nelder–Mead on (φ, Φ, θ).
// Forecast: propagate the filtered state, then integrate the differences back to levels.
// Intervals: ψ-weights of the full ARIMA polynomial (parameter uncertainty ignored, as in statsmodels).

import { mean } from './stats';

const R = 14; // state dimension = max(p, q + 1) with p = 13 (1 + 12), q = 1
const SEASON = 12;
// statsmodels (enforce_stationarity=False) initialises every state diffusely and drops the first
// k_states = 26 observations from the likelihood. On the differenced series (which already lost 13)
// that leaves the first 13 differenced values as burn-in.
const LIKELIHOOD_BURN = 13;

export interface SarimaxParams {
  phi: number; // AR(1)
  Phi: number; // seasonal AR(1)
  theta: number; // MA(1)
  sigma2: number;
}

export interface SarimaxForecast {
  mean: number[];
  lower: number[];
  upper: number[];
}

/** Seasonal + regular differencing: (1 − B)(1 − B¹²) z. */
export function differenceSeries(z: ArrayLike<number>): number[] {
  const d1: number[] = [];
  for (let i = 1; i < z.length; i++) d1.push(z[i] - z[i - 1]);
  const w: number[] = [];
  for (let i = SEASON; i < d1.length; i++) w.push(d1[i] - d1[i - SEASON]);
  return w;
}

function arVector(phi: number, Phi: number): Float64Array {
  const ar = new Float64Array(R);
  ar[0] = phi;
  ar[SEASON - 1] = Phi;
  ar[SEASON] = -phi * Phi;
  return ar;
}

function matMul(A: Float64Array, B: Float64Array): Float64Array {
  const C = new Float64Array(R * R);
  for (let i = 0; i < R; i++) {
    for (let k = 0; k < R; k++) {
      const a = A[i * R + k];
      if (a === 0) continue;
      for (let j = 0; j < R; j++) C[i * R + j] += a * B[k * R + j];
    }
  }
  return C;
}

function transpose(A: Float64Array): Float64Array {
  const T = new Float64Array(R * R);
  for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) T[j * R + i] = A[i * R + j];
  return T;
}

/** Stationary state covariance P = T P Tᵀ + Q by the doubling algorithm; null if it diverges. */
function stationaryCovariance(ar: Float64Array, Q: Float64Array): Float64Array | null {
  let A: Float64Array = new Float64Array(R * R);
  for (let i = 0; i < R; i++) {
    A[i * R] = ar[i];
    if (i < R - 1) A[i * R + i + 1] = 1;
  }
  const P = Q.slice();
  for (let it = 0; it < 60; it++) {
    const APAt = matMul(matMul(A, P), transpose(A));
    let delta = 0;
    for (let k = 0; k < R * R; k++) {
      P[k] += APAt[k];
      const d = Math.abs(APAt[k]);
      if (d > delta) delta = d;
    }
    if (!Number.isFinite(delta)) return null;
    if (delta < 1e-13) break;
    A = matMul(A, A);
  }
  return P;
}

interface FilterResult {
  negLogLik: number;
  sigma2: number;
  /** Predicted state a_{T+1|T} (after the last observation). */
  state: Float64Array;
}

/** Kalman filter for the ARMA(13,1) form of the differenced series, unit innovation variance. */
function kalman(w: number[], phi: number, Phi: number, theta: number, burn = LIKELIHOOD_BURN): FilterResult | null {
  const ar = arVector(phi, Phi);
  const Rv = new Float64Array(R);
  Rv[0] = 1;
  Rv[1] = theta;
  const Q = new Float64Array(R * R);
  for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) Q[i * R + j] = Rv[i] * Rv[j];

  let P: Float64Array | null = stationaryCovariance(ar, Q);
  if (!P) return null;
  let a = new Float64Array(R);
  const K = new Float64Array(R);
  const TP = new Float64Array(R * R);
  let sumLogF = 0;
  let sumV2F = 0;

  for (let t = 0; t < w.length; t++) {
    const F = P[0];
    if (!(F > 1e-12)) return null;
    const v = w[t] - a[0];
    if (t >= burn) {
      sumLogF += Math.log(F);
      sumV2F += (v * v) / F;
    }

    for (let i = 0; i < R; i++) K[i] = P[i * R] / F;
    // Filtered state and covariance
    const af = new Float64Array(R);
    for (let i = 0; i < R; i++) af[i] = a[i] + K[i] * v;
    const Pf = new Float64Array(R * R);
    for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) Pf[i * R + j] = P[i * R + j] - K[i] * P[j];

    // Predict with the companion transition: a' = T af, P' = T Pf Tᵀ + Q
    const an = new Float64Array(R);
    for (let i = 0; i < R; i++) an[i] = ar[i] * af[0] + (i < R - 1 ? af[i + 1] : 0);
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < R; j++) TP[i * R + j] = ar[i] * Pf[j] + (i < R - 1 ? Pf[(i + 1) * R + j] : 0);
    }
    const Pn = new Float64Array(R * R);
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < R; j++) {
        Pn[i * R + j] = TP[i * R] * ar[j] + (j < R - 1 ? TP[i * R + j + 1] : 0) + Q[i * R + j];
      }
    }
    a = an;
    P = Pn;
  }
  const n = w.length - burn;
  const sigma2 = sumV2F / n;
  const negLogLik = 0.5 * (n * Math.log(2 * Math.PI * sigma2) + sumLogF + n);
  return { negLogLik, sigma2, state: a };
}

const BOUND = 0.98;

function objective(w: number[]) {
  return (p: number[]): number => {
    const [phi, Phi, theta] = p;
    if (Math.abs(phi) > BOUND || Math.abs(Phi) > BOUND || Math.abs(theta) > BOUND) return 1e12;
    const res = kalman(w, phi, Phi, theta);
    return res && Number.isFinite(res.negLogLik) ? res.negLogLik : 1e12;
  };
}

function nelderMead(f: (x: number[]) => number, x0: number[], step: number, maxIter: number, tol: number) {
  const n = x0.length;
  let S: number[][] = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] += step;
    S.push(p);
  }
  let V = S.map(f);
  for (let k = 0; k < maxIter; k++) {
    const order = V.map((_, i) => i).sort((a, b) => V[a] - V[b]);
    S = order.map((i) => S[i]);
    V = order.map((i) => V[i]);
    if (Math.abs(V[n] - V[0]) < tol) break;
    const c = S[0].map((_, j) => mean(S.slice(0, n).map((p) => p[j])));
    const xr = c.map((v, j) => v + (v - S[n][j]));
    const fr = f(xr);
    if (fr < V[0]) {
      const xe = c.map((v, j) => v + 2 * (v - S[n][j]));
      const fe = f(xe);
      if (fe < fr) {
        S[n] = xe;
        V[n] = fe;
      } else {
        S[n] = xr;
        V[n] = fr;
      }
    } else if (fr < V[n - 1]) {
      S[n] = xr;
      V[n] = fr;
    } else {
      const xc = c.map((v, j) => v + 0.5 * (S[n][j] - v));
      const fc = f(xc);
      if (fc < V[n]) {
        S[n] = xc;
        V[n] = fc;
      } else {
        for (let i = 1; i <= n; i++) {
          S[i] = S[i].map((v, j) => S[0][j] + 0.5 * (v - S[0][j]));
          V[i] = f(S[i]);
        }
      }
    }
  }
  let b = 0;
  for (let i = 1; i < V.length; i++) if (V[i] < V[b]) b = i;
  return { x: S[b], f: V[b] };
}

export interface SarimaxFit extends SarimaxParams {
  negLogLik: number;
  /** The series the model was fitted on (levels). */
  series: number[];
  state: Float64Array;
}

/** Negative log-likelihood of the differenced series at given parameters (exported for testing). */
export function sarimaxNegLogLik(z: number[], phi: number, Phi: number, theta: number): number {
  return objective(differenceSeries(z))([phi, Phi, theta]);
}

export function fitSarimax(z: number[], starts: number[][] = [[0, 0, 0], [0.3, -0.3, -0.5], [-0.3, -0.2, -0.7]]): SarimaxFit {
  if (z.length < 3 * SEASON) throw new Error(`SARIMAX needs at least ${3 * SEASON} monthly observations (got ${z.length}).`);
  const w = differenceSeries(z);
  const f = objective(w);
  let best: { x: number[]; f: number } | null = null;
  for (const s of starts) {
    const r = nelderMead(f, s, 0.2, 400, 1e-9);
    if (!best || r.f < best.f) best = r;
  }
  const [phi, Phi, theta] = best!.x;
  const k = kalman(w, phi, Phi, theta);
  if (!k) throw new Error('SARIMAX estimation failed to converge.');
  return { phi, Phi, theta, sigma2: k.sigma2, negLogLik: k.negLogLik, series: z.slice(), state: k.state };
}

/** ψ-weights of the integrated ARMA polynomial, for prediction intervals. */
function psiWeights(phi: number, Phi: number, theta: number, h: number): number[] {
  const polyMul = (a: number[], b: number[]) => {
    const out = new Array<number>(a.length + b.length - 1).fill(0);
    a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
    return out;
  };
  const seasonal = (c: number) => {
    const p = new Array<number>(SEASON + 1).fill(0);
    p[0] = 1;
    p[SEASON] = -c;
    return p;
  };
  const A = polyMul(polyMul(polyMul([1, -phi], seasonal(Phi)), [1, -1]), seasonal(1));
  const psi = new Array<number>(h).fill(0);
  for (let j = 0; j < h; j++) {
    let v = j === 0 ? 1 : j === 1 ? theta : 0;
    for (let k = 1; k < A.length && k <= j; k++) v -= A[k] * psi[j - k];
    psi[j] = v;
  }
  return psi;
}

const Z_975 = 1.959963984540054;

export function forecastSarimax(fit: SarimaxFit, h: number): SarimaxForecast {
  let a = fit.state.slice();
  const ar = arVector(fit.phi, fit.Phi);
  const levels = fit.series.slice();
  const out: number[] = [];
  for (let i = 0; i < h; i++) {
    const wf = a[0];
    const an = new Float64Array(R);
    for (let k = 0; k < R; k++) an[k] = ar[k] * a[0] + (k < R - 1 ? a[k + 1] : 0);
    a = an;
    const n = levels.length;
    const next = levels[n - 1] + levels[n - SEASON] - levels[n - SEASON - 1] + wf;
    levels.push(next);
    out.push(next);
  }
  const psi = psiWeights(fit.phi, fit.Phi, fit.theta, h);
  const lower: number[] = [];
  const upper: number[] = [];
  let cum = 0;
  for (let i = 0; i < h; i++) {
    cum += psi[i] ** 2;
    const se = Math.sqrt(fit.sigma2 * cum);
    lower.push(out[i] - Z_975 * se);
    upper.push(out[i] + Z_975 * se);
  }
  return { mean: out, lower, upper };
}
