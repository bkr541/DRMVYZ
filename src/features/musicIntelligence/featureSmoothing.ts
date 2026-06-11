// Lightweight signal-processing utilities for real-time audio feature smoothing.
// All classes are plain objects — no browser APIs, no React — safe in any context.

/** Exponential moving average filter. alpha=1 → instant, alpha→0 → very slow. */
export class EMAFilter {
  private value: number
  private readonly defaultAlpha: number | undefined

  constructor(initial = 0, defaultAlpha?: number) {
    this.value = initial
    this.defaultAlpha = defaultAlpha
  }

  update(input: number, alpha?: number): number {
    const a = alpha ?? this.defaultAlpha ?? 0.1
    this.value = this.value * (1 - a) + input * a
    return this.value
  }

  get current(): number { return this.value }

  reset(v = 0): void { this.value = v }
}

/**
 * Attack/release filter: fast attack (signal rising) + slow release (signal falling).
 * More musical than symmetric EMA for VU-meter-style tracking.
 */
export class AttackReleaseFilter {
  private value: number

  constructor(initial = 0) { this.value = initial }

  /**
   * attackAlpha: how quickly the filter rises (0.4–0.9 typical)
   * releaseAlpha: how quickly the filter falls (0.05–0.25 typical)
   */
  update(input: number, attackAlpha: number, releaseAlpha: number): number {
    const alpha   = input > this.value ? attackAlpha : releaseAlpha
    this.value    = this.value * (1 - alpha) + input * alpha
    return this.value
  }

  get current(): number { return this.value }

  reset(v = 0): void { this.value = v }
}

/** Tracks a running peak that decays toward zero each frame by a multiplicative factor. */
export class PeakFollower {
  private peak: number

  constructor(initial = 0) { this.peak = initial }

  /** decayPerFrame: 0.99 = slow decay (~100 frames to halve), 0.9 = fast. */
  update(input: number, decayPerFrame: number): number {
    this.peak = Math.max(input, this.peak * decayPerFrame)
    return this.peak
  }

  get current(): number { return this.peak }

  reset(): void { this.peak = 0 }
}

/**
 * Tracks a running maximum with slow exponential decay.
 * Used for band normalization: normalized = band / runningMax.
 */
export class RunningMax {
  private max: number
  private readonly decay: number

  constructor(decay = 0.9999) {
    this.max   = 0.001  // small non-zero seed so normalize() is never 0/0
    this.decay = decay
  }

  update(input: number): void {
    this.max = Math.max(input, this.max * this.decay)
  }

  normalize(input: number): number {
    return this.max > 0 ? Math.min(1, input / this.max) : 0
  }

  get current(): number { return this.max }

  reset(): void { this.max = 0.001 }
}

/** Fixed-size circular buffer for energy history / percentile / rolling stats. */
export class FeatureRingBuffer {
  private readonly buf: Float32Array
  private pos   = 0
  private count = 0

  constructor(readonly size: number) {
    this.buf = new Float32Array(size)
  }

  push(value: number): void {
    this.buf[this.pos] = value
    this.pos = (this.pos + 1) % this.size
    if (this.count < this.size) this.count++
  }

  /** Fraction of buffered samples that are ≤ value (empirical CDF). */
  percentile(value: number): number {
    if (this.count === 0) return 0
    let below = 0
    for (let i = 0; i < this.count; i++) below += (this.buf[i] <= value ? 1 : 0)
    return below / this.count
  }

  min(): number {
    if (this.count === 0) return 0
    let m = Infinity
    for (let i = 0; i < this.count; i++) { if (this.buf[i] < m) m = this.buf[i] }
    return m === Infinity ? 0 : m
  }

  max(): number {
    if (this.count === 0) return 0
    let m = -Infinity
    for (let i = 0; i < this.count; i++) { if (this.buf[i] > m) m = this.buf[i] }
    return m === -Infinity ? 0 : m
  }

  mean(): number {
    if (this.count === 0) return 0
    let s = 0
    for (let i = 0; i < this.count; i++) s += this.buf[i]
    return s / this.count
  }

  get filled(): number { return this.count }

  reset(): void { this.buf.fill(0); this.pos = 0; this.count = 0 }
}

// ── Sensitivity / transfer curves ─────────────────────────────────────────────

export type CurveType =
  | 'linear'
  | 'exponential'
  | 'logarithmic'
  | 'smoothstep'
  | 'threshold'
  | 'gate'
  | 'invert'
  | 'clamp'

export interface CurveParams {
  exponent?: number   // for exponential: v^exponent (default 2)
  lo?:       number   // lower bound for threshold/gate/clamp (default 0.5 / 0.1 / 0)
  hi?:       number   // upper bound for clamp (default 1)
}

/**
 * Apply a transfer curve to a value in [0, 1].
 * All curves map [0,1] → [0,1] unless clamp is used with different bounds.
 */
export function applyCurve(value: number, curve: CurveType = 'linear', params: CurveParams = {}): number {
  const v = Math.max(0, Math.min(1, value))
  switch (curve) {
    case 'linear':
      return v
    case 'exponential':
      return Math.pow(v, params.exponent ?? 2)
    case 'logarithmic':
      // Maps [0,1]→[0,1] via natural log: log(1 + v*(e-1)) / 1
      return v <= 0 ? 0 : Math.log(1 + v * (Math.E - 1))
    case 'smoothstep':
      return v * v * (3 - 2 * v)
    case 'threshold': {
      const t = params.lo ?? 0.5
      return v >= t ? (v - t) / Math.max(0.001, 1 - t) : 0
    }
    case 'gate': {
      const dead = params.lo ?? 0.1
      return v < dead ? 0 : Math.min(1, (v - dead) / Math.max(0.001, 1 - dead))
    }
    case 'invert':
      return 1 - v
    case 'clamp': {
      const lo = params.lo ?? 0
      const hi = params.hi ?? 1
      return Math.max(lo, Math.min(hi, value))
    }
    default:
      return v
  }
}
