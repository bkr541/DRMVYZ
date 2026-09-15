export interface Cinema2PixelMetrics {
  pixelCount: number
  activePixelCount: number
  activePixelRatio: number
  meanLuminance: number
  maxLuminance: number
  meanRed: number
  meanGreen: number
  meanBlue: number
  meanChroma: number
}

export interface Cinema2PixelDifferenceMetrics {
  pixelCount: number
  changedPixelCount: number
  changedPixelRatio: number
  meanAbsoluteLuminanceDelta: number
  maxLuminanceDelta: number
  meanAbsoluteChannelDelta: number
}

export interface Cinema2VisibilityThresholds {
  activeLuminance: number
  minimumActivePixelRatio: number
  minimumMeanLuminance: number
  minimumMaxLuminance: number
}

export const CINEMA2_AFTERHOURS_VISIBILITY_THRESHOLDS: Readonly<Cinema2VisibilityThresholds> = Object.freeze({
  // Ignore tiny non-zero GPU/background noise. After Hours 2.0 uses a black
  // authored background, so visible laser energy should clear these by a wide
  // margin while a dim/undefined framebuffer should not.
  activeLuminance: 0.02,
  minimumActivePixelRatio: 0.0002,
  minimumMeanLuminance: 0.00005,
  minimumMaxLuminance: 0.05,
})

const clampByte = (value: number | undefined): number => Math.max(0, Math.min(255, value ?? 0))
const normalizedLuminance = (r: number, g: number, b: number): number => (
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
)

export function measureCinema2RgbaPixels(
  pixels: ArrayLike<number>,
  thresholds: Readonly<Cinema2VisibilityThresholds> = CINEMA2_AFTERHOURS_VISIBILITY_THRESHOLDS,
): Cinema2PixelMetrics {
  if (pixels.length % 4 !== 0) throw new Error('RGBA pixel data length must be divisible by four.')
  const pixelCount = pixels.length / 4
  if (pixelCount === 0) {
    return {
      pixelCount: 0,
      activePixelCount: 0,
      activePixelRatio: 0,
      meanLuminance: 0,
      maxLuminance: 0,
      meanRed: 0,
      meanGreen: 0,
      meanBlue: 0,
      meanChroma: 0,
    }
  }

  let activePixelCount = 0
  let luminanceSum = 0
  let maxLuminance = 0
  let redSum = 0
  let greenSum = 0
  let blueSum = 0
  let chromaSum = 0

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const r = clampByte(pixels[offset])
    const g = clampByte(pixels[offset + 1])
    const b = clampByte(pixels[offset + 2])
    const luminance = normalizedLuminance(r, g, b)
    luminanceSum += luminance
    maxLuminance = Math.max(maxLuminance, luminance)
    redSum += r / 255
    greenSum += g / 255
    blueSum += b / 255
    chromaSum += (Math.max(r, g, b) - Math.min(r, g, b)) / 255
    if (luminance >= thresholds.activeLuminance) activePixelCount += 1
  }

  return {
    pixelCount,
    activePixelCount,
    activePixelRatio: activePixelCount / pixelCount,
    meanLuminance: luminanceSum / pixelCount,
    maxLuminance,
    meanRed: redSum / pixelCount,
    meanGreen: greenSum / pixelCount,
    meanBlue: blueSum / pixelCount,
    meanChroma: chromaSum / pixelCount,
  }
}

export function isCinema2FrameMeaningfullyVisible(
  metrics: Readonly<Cinema2PixelMetrics>,
  thresholds: Readonly<Cinema2VisibilityThresholds> = CINEMA2_AFTERHOURS_VISIBILITY_THRESHOLDS,
): boolean {
  return metrics.pixelCount > 0
    && metrics.activePixelRatio >= thresholds.minimumActivePixelRatio
    && metrics.meanLuminance >= thresholds.minimumMeanLuminance
    && metrics.maxLuminance >= thresholds.minimumMaxLuminance
}

export function compareCinema2RgbaPixels(
  before: ArrayLike<number>,
  after: ArrayLike<number>,
  changedLuminanceThreshold = 0.015,
): Cinema2PixelDifferenceMetrics {
  if (before.length !== after.length || before.length % 4 !== 0) {
    throw new Error('RGBA pixel buffers must have equal lengths divisible by four.')
  }
  const pixelCount = before.length / 4
  if (pixelCount === 0) {
    return {
      pixelCount: 0,
      changedPixelCount: 0,
      changedPixelRatio: 0,
      meanAbsoluteLuminanceDelta: 0,
      maxLuminanceDelta: 0,
      meanAbsoluteChannelDelta: 0,
    }
  }

  let changedPixelCount = 0
  let luminanceDeltaSum = 0
  let maxLuminanceDelta = 0
  let channelDeltaSum = 0

  for (let offset = 0; offset < before.length; offset += 4) {
    const beforeR = clampByte(before[offset])
    const beforeG = clampByte(before[offset + 1])
    const beforeB = clampByte(before[offset + 2])
    const afterR = clampByte(after[offset])
    const afterG = clampByte(after[offset + 1])
    const afterB = clampByte(after[offset + 2])
    const luminanceDelta = Math.abs(
      normalizedLuminance(afterR, afterG, afterB) - normalizedLuminance(beforeR, beforeG, beforeB),
    )
    luminanceDeltaSum += luminanceDelta
    maxLuminanceDelta = Math.max(maxLuminanceDelta, luminanceDelta)
    channelDeltaSum += (Math.abs(afterR - beforeR) + Math.abs(afterG - beforeG) + Math.abs(afterB - beforeB)) / (255 * 3)
    if (luminanceDelta >= changedLuminanceThreshold) changedPixelCount += 1
  }

  return {
    pixelCount,
    changedPixelCount,
    changedPixelRatio: changedPixelCount / pixelCount,
    meanAbsoluteLuminanceDelta: luminanceDeltaSum / pixelCount,
    maxLuminanceDelta,
    meanAbsoluteChannelDelta: channelDeltaSum / pixelCount,
  }
}
