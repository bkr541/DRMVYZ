export interface Cinema2InterlockPixelMetrics {
  pixelCount: number
  activePixelCount: number
  activePixelRatio: number
  brightCorePixelCount: number
  brightCoreRatio: number
  clippedPixelCount: number
  clippedRatio: number
  nearWhitePixelCount: number
  nearWhiteRatio: number
  meanLuminance: number
  medianLuminance: number
  p90Luminance: number
  maxLuminance: number
  highlightToMedianSeparation: number
  segmentGapContrastRatio: number
  meanRed: number
  meanGreen: number
  meanBlue: number
}

export interface Cinema2InterlockDifferenceMetrics {
  pixelCount: number
  changedPixelCount: number
  changedPixelRatio: number
  meanAbsoluteLuminanceDelta: number
  maxLuminanceDelta: number
  repeatSimilarity: number
}

export interface Cinema2InterlockMetricThresholds {
  activeLuminance: number
  brightCoreLuminance: number
  clippedLuminance: number
  nearWhiteLuminance: number
  localContrastDelta: number
}

export const CINEMA2_INTERLOCK_METRIC_THRESHOLDS: Readonly<Cinema2InterlockMetricThresholds> = Object.freeze({
  activeLuminance: 0.02,
  brightCoreLuminance: 0.55,
  clippedLuminance: 0.985,
  nearWhiteLuminance: 0.94,
  localContrastDelta: 0.12,
})

const clampByte = (value: number | undefined): number => Math.max(0, Math.min(255, value ?? 0))
const luminance = (r: number, g: number, b: number): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

export function measureCinema2InterlockRgbaPixels(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  thresholds: Readonly<Cinema2InterlockMetricThresholds> = CINEMA2_INTERLOCK_METRIC_THRESHOLDS,
): Cinema2InterlockPixelMetrics {
  if (width < 0 || height < 0 || width * height * 4 !== pixels.length) {
    throw new Error('Interlock RGBA dimensions must exactly match the pixel buffer.')
  }
  const pixelCount = width * height
  if (pixelCount === 0) return emptyMetrics()

  let activePixelCount = 0
  let brightCorePixelCount = 0
  let clippedPixelCount = 0
  let nearWhitePixelCount = 0
  let sum = 0
  let maxLuminance = 0
  let redSum = 0
  let greenSum = 0
  let blueSum = 0
  let highContrastEdges = 0
  let testedEdges = 0
  const values = new Float32Array(pixelCount)

  for (let pixelIndex = 0, offset = 0; pixelIndex < pixelCount; pixelIndex += 1, offset += 4) {
    const r = clampByte(pixels[offset])
    const g = clampByte(pixels[offset + 1])
    const b = clampByte(pixels[offset + 2])
    const luma = luminance(r, g, b)
    values[pixelIndex] = luma
    sum += luma
    maxLuminance = Math.max(maxLuminance, luma)
    redSum += r / 255
    greenSum += g / 255
    blueSum += b / 255
    if (luma >= thresholds.activeLuminance) activePixelCount += 1
    if (luma >= thresholds.brightCoreLuminance) brightCorePixelCount += 1
    if (luma >= thresholds.clippedLuminance) clippedPixelCount += 1
    if (luma >= thresholds.nearWhiteLuminance && Math.max(r, g, b) - Math.min(r, g, b) <= 12) nearWhitePixelCount += 1
  }

  // Segment gaps create repeated local dark/light transitions. Sampling both
  // axes keeps the metric useful across all five legal Interlock rotations.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const here = values[index] ?? 0
      if (x + 1 < width) {
        testedEdges += 1
        if (Math.abs(here - (values[index + 1] ?? 0)) >= thresholds.localContrastDelta) highContrastEdges += 1
      }
      if (y + 1 < height) {
        testedEdges += 1
        if (Math.abs(here - (values[index + width] ?? 0)) >= thresholds.localContrastDelta) highContrastEdges += 1
      }
    }
  }

  const sorted = Array.from(values).sort((a, b) => a - b)
  const medianLuminance = percentile(sorted, 0.5)
  const p90Luminance = percentile(sorted, 0.9)

  return {
    pixelCount,
    activePixelCount,
    activePixelRatio: activePixelCount / pixelCount,
    brightCorePixelCount,
    brightCoreRatio: brightCorePixelCount / pixelCount,
    clippedPixelCount,
    clippedRatio: clippedPixelCount / pixelCount,
    nearWhitePixelCount,
    nearWhiteRatio: nearWhitePixelCount / pixelCount,
    meanLuminance: sum / pixelCount,
    medianLuminance,
    p90Luminance,
    maxLuminance,
    highlightToMedianSeparation: p90Luminance - medianLuminance,
    segmentGapContrastRatio: testedEdges > 0 ? highContrastEdges / testedEdges : 0,
    meanRed: redSum / pixelCount,
    meanGreen: greenSum / pixelCount,
    meanBlue: blueSum / pixelCount,
  }
}

export function compareCinema2InterlockRgbaPixels(
  before: ArrayLike<number>,
  after: ArrayLike<number>,
  changedLuminanceThreshold = 0.015,
): Cinema2InterlockDifferenceMetrics {
  if (before.length !== after.length || before.length % 4 !== 0) throw new Error('Interlock RGBA buffers must have equal lengths divisible by four.')
  const pixelCount = before.length / 4
  if (pixelCount === 0) return { pixelCount: 0, changedPixelCount: 0, changedPixelRatio: 0, meanAbsoluteLuminanceDelta: 0, maxLuminanceDelta: 0, repeatSimilarity: 1 }

  let changedPixelCount = 0
  let sum = 0
  let max = 0
  for (let offset = 0; offset < before.length; offset += 4) {
    const beforeLuma = luminance(clampByte(before[offset]), clampByte(before[offset + 1]), clampByte(before[offset + 2]))
    const afterLuma = luminance(clampByte(after[offset]), clampByte(after[offset + 1]), clampByte(after[offset + 2]))
    const delta = Math.abs(beforeLuma - afterLuma)
    sum += delta
    max = Math.max(max, delta)
    if (delta >= changedLuminanceThreshold) changedPixelCount += 1
  }
  const changedPixelRatio = changedPixelCount / pixelCount
  return {
    pixelCount,
    changedPixelCount,
    changedPixelRatio,
    meanAbsoluteLuminanceDelta: sum / pixelCount,
    maxLuminanceDelta: max,
    repeatSimilarity: 1 - changedPixelRatio,
  }
}

export function isCinema2InterlockFrameVisible(metrics: Readonly<Cinema2InterlockPixelMetrics>): boolean {
  return metrics.pixelCount > 0
    && metrics.activePixelRatio >= 0.002
    && metrics.meanLuminance >= 0.0005
    && metrics.maxLuminance >= 0.08
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))
  return sorted[index] ?? 0
}

function emptyMetrics(): Cinema2InterlockPixelMetrics {
  return {
    pixelCount: 0,
    activePixelCount: 0,
    activePixelRatio: 0,
    brightCorePixelCount: 0,
    brightCoreRatio: 0,
    clippedPixelCount: 0,
    clippedRatio: 0,
    nearWhitePixelCount: 0,
    nearWhiteRatio: 0,
    meanLuminance: 0,
    medianLuminance: 0,
    p90Luminance: 0,
    maxLuminance: 0,
    highlightToMedianSeparation: 0,
    segmentGapContrastRatio: 0,
    meanRed: 0,
    meanGreen: 0,
    meanBlue: 0,
  }
}
