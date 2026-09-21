// NumPy-compatible Mersenne Twister so `np.random.seed(42)` + `np.random.uniform`
// produce the exact same draws in the browser as in ml8.py.

const N = 624;
const M = 397;

export class MT19937 {
  private mt = new Uint32Array(N);
  private idx = N;

  constructor(seed: number) {
    this.mt[0] = seed >>> 0;
    for (let i = 1; i < N; i++) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
  }

  private nextU32(): number {
    if (this.idx >= N) {
      for (let k = 0; k < N; k++) {
        const y = (this.mt[k] & 0x80000000) | (this.mt[(k + 1) % N] & 0x7fffffff);
        let v = this.mt[(k + M) % N] ^ (y >>> 1);
        if (y & 1) v ^= 0x9908b0df;
        this.mt[k] = v >>> 0;
      }
      this.idx = 0;
    }
    let y = this.mt[this.idx++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** Same as numpy `random_sample()`: 53-bit float in [0, 1). */
  random(): number {
    const a = this.nextU32() >>> 5;
    const b = this.nextU32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  /** Same as `np.random.uniform(low, high, n)`. */
  uniform(low: number, high: number, n: number): Float64Array {
    const out = new Float64Array(n);
    const span = high - low;
    for (let i = 0; i < n; i++) out[i] = low + span * this.random();
    return out;
  }
}
