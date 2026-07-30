export type HarmonicRibbonBandId = 'high' | 'mid' | 'low'

export interface HarmonicRibbonBandLayout {
  id: HarmonicRibbonBandId
  centerRatio: number
  amplitudeRatio: number
  colorKey: 'primary' | 'secondary' | 'highlight'
}

export interface HarmonicRibbonSignalBands {
  high: Float32Array
  mid: Float32Array
  low: Float32Array
}

export const HARMONIC_RIBBON_SAMPLE_COUNT = 256

/**
 * Three intentionally separated horizontal lanes. Their envelopes leave a
 * minimum 5.5% canvas-height gap, so current geometry and short history can
 * never collapse into one continuous wall of light.
 */
export const HARMONIC_RIBBON_BAND_LAYOUT: readonly HarmonicRibbonBandLayout[] = [
  { id: 'high', centerRatio: 0.22, amplitudeRatio: 0.105, colorKey: 'secondary' },
  { id: 'mid', centerRatio: 0.5, amplitudeRatio: 0.135, colorKey: 'primary' },
  { id: 'low', centerRatio: 0.78, amplitudeRatio: 0.105, colorKey: 'highlight' },
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function sampleTimeDomain(
  timeDomainData: Uint8Array<ArrayBuffer> | null,
  sampleIndex: number,
  sampleCount: number,
): number {
  if (!timeDomainData || timeDomainData.length === 0 || sampleCount <= 1) return 0
  const sourceIndex = Math.round((sampleIndex / (sampleCount - 1)) * (timeDomainData.length - 1))
  return ((timeDomainData[sourceIndex] ?? 128) - 128) / 128
}

function boxSmooth(input: Float32Array, radius: number): Float32Array {
  if (radius <= 0) return input.slice()
  const output = new Float32Array(input.length)
  const width = radius * 2 + 1
  for (let i = 0; i < input.length; i++) {
    let total = 0
    for (let offset = -radius; offset <= radius; offset++) {
      total += input[clamp(i + offset, 0, input.length - 1)] ?? 0
    }
    output[i] = total / width
  }
  return output
}

function normalizeBand(input: Float32Array, maximumGain: number): Float32Array {
  let peak = 0
  for (let i = 0; i < input.length; i++) peak = Math.max(peak, Math.abs(input[i] ?? 0))

  // Preserve silence and low-level dynamics. Only prevent a naturally healthy
  // waveform from under-filling its lane; never turn analyser noise into a wall.
  const gain = peak >= 0.08 ? Math.min(maximumGain, 0.82 / peak) : 1
  const output = new Float32Array(input.length)
  for (let i = 0; i < input.length; i++) output[i] = clamp((input[i] ?? 0) * gain, -1, 1)
  return output
}

/**
 * Splits the mono time-domain capture into three stable contour families.
 * This is not a spectral measurement; it is phase-coherent visual conditioning:
 * low uses a broad trend, mid uses the difference between medium and broad
 * trends, and high uses the residual detail around the short trend.
 */
export function buildHarmonicRibbonSignalBands(
  timeDomainData: Uint8Array<ArrayBuffer> | null,
  sampleCount = HARMONIC_RIBBON_SAMPLE_COUNT,
): HarmonicRibbonSignalBands {
  const count = Math.max(16, Math.round(sampleCount))
  const raw = new Float32Array(count)
  for (let i = 0; i < count; i++) raw[i] = sampleTimeDomain(timeDomainData, i, count)

  const short = boxSmooth(raw, 2)
  const medium = boxSmooth(raw, 6)
  const broad = boxSmooth(raw, 15)
  const high = new Float32Array(count)
  const mid = new Float32Array(count)
  const low = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const rawSample = raw[i] ?? 0
    const shortSample = short[i] ?? 0
    const mediumSample = medium[i] ?? 0
    const broadSample = broad[i] ?? 0

    high[i] = (rawSample - shortSample) * 1.35 + (shortSample - mediumSample) * 1.1 + mediumSample * 0.2
    mid[i] = (mediumSample - broadSample) * 1.65 + broadSample * 0.42
    low[i] = broadSample * 1.28
  }

  return {
    high: normalizeBand(high, 1.65),
    mid: normalizeBand(mid, 1.55),
    low: normalizeBand(low, 1.4),
  }
}

/** Exact simultaneous trace offsets, centered around the master contour. */
export function resolveHarmonicRibbonTraceOffsets(traceCount: number): readonly number[] {
  const count = Math.round(clamp(traceCount, 1, 6))
  if (count === 1) return [0]
  return Array.from({ length: count }, (_, index) => -1 + (index / (count - 1)) * 2)
}

/**
 * The live master contour must remain unmistakable above every supporting trace.
 * Supporting lines are intentionally capped at a small fraction of the master's
 * opacity, while both roles still respect the layer's resolved brightness.
 */
export function resolveHarmonicRibbonMasterTraceAlpha(brightness: number, energy: number): number {
  return clamp(brightness * (0.94 + clamp(energy, 0, 1.2) * 0.05), 0, 1)
}

export function resolveHarmonicRibbonSupportingTraceAlpha(
  distanceFromMaster: number,
  brightness: number,
  energy: number,
): number {
  const distance = Math.abs(distanceFromMaster)
  const supportLevel = Math.max(0.07, 0.14 - distance * 0.035)
  return clamp(supportLevel * brightness * (0.82 + clamp(energy, 0, 1.2) * 0.1), 0, 0.16)
}

/**
 * History is only a dim motion echo. It is both written and presented at a
 * reduced level so a saturated trail buffer cannot become a visible rectangle.
 */
export function resolveHarmonicRibbonHistoryWriteAlpha(historyWriteAlpha: number): number {
  return clamp(historyWriteAlpha * 0.25, 0, 0.06)
}

export function resolveHarmonicRibbonHistoryPresentationAlpha(trailPersistence: number): number {
  return clamp(trailPersistence * 0.28, 0, 0.08)
}
