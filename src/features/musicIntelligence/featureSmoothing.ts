// Lightweight signal-processing utilities for real-time audio feature smoothing.
// All classes are plain objects — no browser APIs, no React — safe in any context.

/** Exponential moving average filter. alpha=1 → instant, alpha→0 → very slow. */
export class EMAFilter {
  private value: number

  constructor(initial = 0) {
    this.value = initial
  }

  update(input: number, alpha: number): number {
    this.value = this.value * (1 - alpha) + input * alpha
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

/** Fixed-size circular buffer for energy history / percentile computation. */
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

  get filled(): number { return this.count }

  reset(): void { this.buf.fill(0); this.pos = 0; this.count = 0 }
}
