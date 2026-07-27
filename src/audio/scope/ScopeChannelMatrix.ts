import type { ScopeSignalMode, ScopeTriggerSource } from './scopeTypes'

/**
 * Normalized mid/side conversion.
 *
 * The 1/√2 factor keeps total energy constant, so a hard-panned source and a
 * centered source of equal level produce comparable trace amplitudes. The naive
 * (L+R)/2 form makes mid quieter than either channel and misrepresents width.
 */
export function midFromStereo(left: number, right: number): number {
  return (left + right) * Math.SQRT1_2
}

export function sideFromStereo(left: number, right: number): number {
  return (left - right) * Math.SQRT1_2
}

/** Result of matrixing one window into plot axes. */
export interface ScopeMatrixResult {
  /** Valid sample count written into x/y (and secondary, when present). */
  length: number
  /** True when a second Y trace was written for dual-waveform display. */
  hasSecondary: boolean
}

export interface ScopeMatrixInput {
  left: Float32Array
  right: Float32Array
  /** Frames to read from `left`/`right`, starting at `sourceOffset`. */
  length: number
  sourceOffset: number
  mode: ScopeSignalMode
  /** Delay in samples used by `monoDelayXY`. */
  monoDelaySamples: number
  /** Filled low band for `bandSplitXY`; falls back to mono when absent. */
  lowBand?: Float32Array | null
  /** Filled high band for `bandSplitXY`; falls back to mono when absent. */
  highBand?: Float32Array | null
  /** Phase used to synthesize `proceduralFallback`, in radians. */
  proceduralPhase?: number
}

export interface ScopeMatrixOutput {
  x: Float32Array
  y: Float32Array
  secondaryY: Float32Array
}

/**
 * Matrixes a synchronized stereo window into plot axes.
 *
 * Waveform modes write a normalized 0..1 time ramp into X, so a single
 * downstream renderer handles both waveform and X/Y traces without branching on
 * mode. Writes into caller-owned buffers; allocates nothing.
 */
export function applyScopeChannelMatrix(
  input: ScopeMatrixInput,
  output: ScopeMatrixOutput,
): ScopeMatrixResult {
  const { left, right, mode, sourceOffset } = input
  const count = Math.min(
    input.length,
    output.x.length,
    output.y.length,
    Math.max(0, left.length - sourceOffset),
    Math.max(0, right.length - sourceOffset),
  )
  if (count <= 0) return { length: 0, hasSecondary: false }

  const { x, y, secondaryY } = output
  const denominator = count > 1 ? count - 1 : 1

  switch (mode) {
    case 'left':
      for (let i = 0; i < count; i++) {
        x[i] = i / denominator
        y[i] = left[sourceOffset + i]
      }
      return { length: count, hasSecondary: false }

    case 'right':
      for (let i = 0; i < count; i++) {
        x[i] = i / denominator
        y[i] = right[sourceOffset + i]
      }
      return { length: count, hasSecondary: false }

    case 'mono':
      for (let i = 0; i < count; i++) {
        x[i] = i / denominator
        y[i] = midFromStereo(left[sourceOffset + i], right[sourceOffset + i]) * Math.SQRT1_2
      }
      return { length: count, hasSecondary: false }

    case 'dualWaveform': {
      const hasSecondary = secondaryY.length >= count
      for (let i = 0; i < count; i++) {
        x[i] = i / denominator
        y[i] = left[sourceOffset + i]
        if (hasSecondary) secondaryY[i] = right[sourceOffset + i]
      }
      return { length: count, hasSecondary }
    }

    case 'stereoXY':
      for (let i = 0; i < count; i++) {
        x[i] = left[sourceOffset + i]
        y[i] = right[sourceOffset + i]
      }
      return { length: count, hasSecondary: false }

    case 'midSideXY':
      for (let i = 0; i < count; i++) {
        const l = left[sourceOffset + i]
        const r = right[sourceOffset + i]
        x[i] = midFromStereo(l, r)
        y[i] = sideFromStereo(l, r)
      }
      return { length: count, hasSecondary: false }

    case 'sumDifferenceXY':
      for (let i = 0; i < count; i++) {
        const l = left[sourceOffset + i]
        const r = right[sourceOffset + i]
        x[i] = l + r
        y[i] = l - r
      }
      return { length: count, hasSecondary: false }

    case 'monoDelayXY': {
      // Artistic phase portrait: one channel against a delayed copy of itself.
      // Reads behind `sourceOffset` where possible so the delayed axis uses real
      // earlier audio rather than the zero-padding a clamped index would give.
      const delay = Math.max(1, Math.floor(input.monoDelaySamples))
      for (let i = 0; i < count; i++) {
        const index = sourceOffset + i
        const mono = midFromStereo(left[index], right[index]) * Math.SQRT1_2
        const delayedIndex = index - delay
        const delayed =
          delayedIndex >= 0
            ? midFromStereo(left[delayedIndex], right[delayedIndex]) * Math.SQRT1_2
            : 0
        x[i] = mono
        y[i] = delayed
      }
      return { length: count, hasSecondary: false }
    }

    case 'bandSplitXY': {
      const low = input.lowBand
      const high = input.highBand
      for (let i = 0; i < count; i++) {
        const index = sourceOffset + i
        const mono = midFromStereo(left[index], right[index]) * Math.SQRT1_2
        x[i] = low && index < low.length ? low[index] : mono
        y[i] = high && index < high.length ? high[index] : mono
      }
      return { length: count, hasSecondary: false }
    }

    case 'proceduralFallback':
    default: {
      // No usable capture: a slow, bounded figure so the display reads as
      // "idle instrument" rather than a frozen or broken trace.
      const phase = input.proceduralPhase ?? 0
      for (let i = 0; i < count; i++) {
        const t = (i / denominator) * Math.PI * 2
        x[i] = Math.sin(t + phase) * 0.6
        y[i] = Math.sin(t * 1.5 + phase * 0.5) * 0.6
      }
      return { length: count, hasSecondary: false }
    }
  }
}

/**
 * Extracts the trigger source channel into `out`.
 * Triggering on the matrixed display axis would make the trace chase its own
 * geometry in X/Y modes, so the source is always derived from raw L/R.
 */
export function extractTriggerSource(
  left: Float32Array,
  right: Float32Array,
  length: number,
  source: ScopeTriggerSource,
  out: Float32Array,
): number {
  const count = Math.min(length, left.length, right.length, out.length)
  for (let i = 0; i < count; i++) {
    const l = left[i]
    const r = right[i]
    switch (source) {
      case 'left':
        out[i] = l
        break
      case 'right':
        out[i] = r
        break
      case 'side':
        out[i] = sideFromStereo(l, r)
        break
      case 'sum':
        out[i] = l + r
        break
      case 'difference':
        out[i] = l - r
        break
      case 'mid':
      default:
        out[i] = midFromStereo(l, r)
        break
    }
  }
  return count
}

/**
 * Pearson correlation between the two channels over `length` samples.
 *
 * +1 is mono-compatible, 0 is uncorrelated, −1 is fully out of phase. Returns 0
 * when either channel is silent, where correlation is undefined rather than zero
 * — reporting "uncorrelated" is the safe reading for a meter.
 */
export function computeChannelCorrelation(
  left: Float32Array,
  right: Float32Array,
  length: number,
): number {
  const count = Math.min(length, left.length, right.length)
  if (count < 2) return 0

  let sumL = 0
  let sumR = 0
  for (let i = 0; i < count; i++) {
    sumL += left[i]
    sumR += right[i]
  }
  const meanL = sumL / count
  const meanR = sumR / count

  let covariance = 0
  let varianceL = 0
  let varianceR = 0
  for (let i = 0; i < count; i++) {
    const dl = left[i] - meanL
    const dr = right[i] - meanR
    covariance += dl * dr
    varianceL += dl * dl
    varianceR += dr * dr
  }

  const denominator = Math.sqrt(varianceL * varianceR)
  if (denominator <= 1e-12) return 0
  const correlation = covariance / denominator
  return Number.isFinite(correlation) ? Math.max(-1, Math.min(1, correlation)) : 0
}
