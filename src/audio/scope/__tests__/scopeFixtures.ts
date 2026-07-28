import type { StereoScopeFrame } from '../scopeTypes'

/**
 * Deterministic synthetic stereo fixtures.
 *
 * Generated analytically rather than through OfflineAudioContext so the node
 * unit partition stays free of Web Audio, and so every expectation can be
 * derived from closed-form maths rather than from a recorded render.
 */

export const FIXTURE_SAMPLE_RATE = 48_000

export interface StereoFixtureOptions {
  sampleRate?: number
  frequencyHz?: number
  length?: number
  leftGain?: number
  rightGain?: number
  /** Right-channel phase offset in radians. */
  rightPhase?: number
  /** DC added to both channels; used to exercise AC coupling. */
  dcOffset?: number
  channelCount?: number
  startPhase?: number
}

export function createStereoSineFrame(options: StereoFixtureOptions = {}): StereoScopeFrame {
  const sampleRate = options.sampleRate ?? FIXTURE_SAMPLE_RATE
  const frequency = options.frequencyHz ?? 440
  const length = options.length ?? 4096
  const leftGain = options.leftGain ?? 1
  const rightGain = options.rightGain ?? 1
  const rightPhase = options.rightPhase ?? 0
  const dc = options.dcOffset ?? 0
  const startPhase = options.startPhase ?? 0

  const left = new Float32Array(length)
  const right = new Float32Array(length)
  const step = (Math.PI * 2 * frequency) / sampleRate

  for (let i = 0; i < length; i++) {
    const phase = startPhase + i * step
    left[i] = Math.sin(phase) * leftGain + dc
    right[i] = Math.sin(phase + rightPhase) * rightGain + dc
  }

  return {
    left,
    right,
    sampleRate,
    startFrame: 0,
    sequenceNumber: 1,
    audioTimeSeconds: 0,
    channelCount: options.channelCount ?? 2,
  }
}

/** Mono source: R is a duplicate of L, and channelCount reports the truth. */
export function createMonoFrame(options: StereoFixtureOptions = {}): StereoScopeFrame {
  const frame = createStereoSineFrame({ ...options, rightPhase: 0, rightGain: options.leftGain ?? 1 })
  frame.right.set(frame.left)
  frame.channelCount = 1
  return frame
}

export function createSilentFrame(length = 4096, sampleRate = FIXTURE_SAMPLE_RATE): StereoScopeFrame {
  return {
    left: new Float32Array(length),
    right: new Float32Array(length),
    sampleRate,
    startFrame: 0,
    sequenceNumber: 1,
    audioTimeSeconds: 0,
    channelCount: 2,
  }
}

/** Deterministic pseudo-noise. Seeded so failures are reproducible. */
export function createNoiseFrame(
  length = 4096,
  sampleRate = FIXTURE_SAMPLE_RATE,
  seed = 12_345,
): StereoScopeFrame {
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  let state = seed >>> 0
  const nextRandom = (): number => {
    // xorshift32 — small, deterministic, adequate for a test signal.
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0xffffffff
  }
  for (let i = 0; i < length; i++) {
    left[i] = nextRandom() * 2 - 1
    right[i] = nextRandom() * 2 - 1
  }
  return { left, right, sampleRate, startFrame: 0, sequenceNumber: 1, audioTimeSeconds: 0, channelCount: 2 }
}

/** Single full-scale impulse on a silent bed. */
export function createImpulseFrame(
  length = 4096,
  impulseIndex = 1024,
  sampleRate = FIXTURE_SAMPLE_RATE,
): StereoScopeFrame {
  const frame = createSilentFrame(length, sampleRate)
  frame.left[impulseIndex] = 1
  frame.right[impulseIndex] = 1
  return frame
}

/** Linear frequency sweep, for timebase and trigger stability under change. */
export function createSweepFrame(
  startHz: number,
  endHz: number,
  length = 8192,
  sampleRate = FIXTURE_SAMPLE_RATE,
): StereoScopeFrame {
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  let phase = 0
  for (let i = 0; i < length; i++) {
    const progress = i / Math.max(1, length - 1)
    const frequency = startHz + (endHz - startHz) * progress
    phase += (Math.PI * 2 * frequency) / sampleRate
    const value = Math.sin(phase)
    left[i] = value
    right[i] = value
  }
  return { left, right, sampleRate, startFrame: 0, sequenceNumber: 1, audioTimeSeconds: 0, channelCount: 2 }
}

/** Root-mean-square of the first `length` samples. */
export function rms(values: Float32Array, length = values.length): number {
  let sum = 0
  const count = Math.min(length, values.length)
  if (count === 0) return 0
  for (let i = 0; i < count; i++) sum += values[i] * values[i]
  return Math.sqrt(sum / count)
}

/**
 * Mean absolute deviation from the identity line y = x, over `length` points.
 * Near zero means the plotted figure is the positive diagonal.
 */
export function meanDistanceFromPositiveDiagonal(
  x: Float32Array,
  y: Float32Array,
  length: number,
): number {
  let sum = 0
  for (let i = 0; i < length; i++) sum += Math.abs(y[i] - x[i])
  return sum / Math.max(1, length)
}

/** Mean absolute deviation from y = −x. */
export function meanDistanceFromNegativeDiagonal(
  x: Float32Array,
  y: Float32Array,
  length: number,
): number {
  let sum = 0
  for (let i = 0; i < length; i++) sum += Math.abs(y[i] + x[i])
  return sum / Math.max(1, length)
}

/**
 * Roundness, independent of size: the spread of the plotted radius as a fraction
 * of its mean. Near zero means a circle at whatever scale.
 *
 * Scale-invariant on purpose — auto-gain sets the figure's size, so asserting an
 * absolute radius would test the gain stage rather than the geometry.
 */
export function radiusVariation(x: Float32Array, y: Float32Array, length: number): number {
  if (length < 2) return 0
  let sum = 0
  for (let i = 0; i < length; i++) sum += Math.hypot(x[i], y[i])
  const mean = sum / length
  if (mean <= 1e-9) return 0
  let maxDeviation = 0
  for (let i = 0; i < length; i++) {
    maxDeviation = Math.max(maxDeviation, Math.abs(Math.hypot(x[i], y[i]) - mean))
  }
  return maxDeviation / mean
}

/**
 * Mean absolute deviation of the plotted radius from `expectedRadius`.
 * Near zero means the figure is a circle of that radius.
 */
export function meanRadiusError(
  x: Float32Array,
  y: Float32Array,
  length: number,
  expectedRadius: number,
): number {
  let sum = 0
  for (let i = 0; i < length; i++) {
    sum += Math.abs(Math.sqrt(x[i] * x[i] + y[i] * y[i]) - expectedRadius)
  }
  return sum / Math.max(1, length)
}
