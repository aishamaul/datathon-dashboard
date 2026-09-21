export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmt1 = (n: number) => n.toFixed(1);
export const fmt2 = (n: number) => n.toFixed(2);
export const pct1 = (frac: number) => `${(frac * 100).toFixed(1)}%`;
/** Signed percentage from a value already in percent, e.g. -55.4 -> "−55%". */
export const signedPct = (p: number, digits = 0) => {
  const v = Math.abs(p).toFixed(digits);
  return `${p < 0 ? '−' : '+'}${v}%`;
};
