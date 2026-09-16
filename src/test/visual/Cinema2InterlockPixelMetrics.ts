import { resolveCinema2InterlockLayout } from '../../components/vyzualz/cinema2/modules/interlock/Cinema2InterlockGeometry'
import { resolveCinema2InterlockRendererInstanceDimensions } from '../../components/vyzualz/cinema2/modules/interlock/Cinema2InterlockRenderEnvelope'
import { CINEMA2_INTERLOCK_FIXTURE_COUNT, type Cinema2InterlockPatternId } from '../../components/vyzualz/cinema2/modules/interlock/Cinema2InterlockDomain'
import { CINEMA2_INTERLOCK_RIG } from '../../components/vyzualz/cinema2/modules/interlock/Cinema2InterlockRig'
import { resolveCinema2InterlockCellCount } from '../../components/vyzualz/cinema2/modules/interlock/Cinema2InterlockSegments'

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

export interface Cinema2InterlockFixtureReadabilityMetrics {
  fixtureCount: number
  visibleFixtureCount: number
  visibleFixtureRatio: number
  sampleCount: number
  visibleSampleCount: number
  visibleSampleRatio: number
  meanCoreLuminance: number
  meanLocalBackgroundLuminance: number
  meanCoreBackgroundSeparation: number
  maxCoreBackgroundSeparation: number
  longitudinalEdgeCount: number
  highContrastLongitudinalEdgeCount: number
  segmentGapSampleCount: number
  readableSegmentGapCount: number
  meanSegmentGapContrast: number
  segmentGapContrastRatio: number
}

/**
 * Samples the canonical 28-fixture geometry directly instead of allowing a
 * bright fullscreen background to satisfy Interlock acceptance. Each structural
 * sample compares the fixture core against both sides just outside the finite
 * renderer envelope; a background gradient therefore cannot cheaply masquerade
 * as an LED bar. Centerline diagnostics plus authored cell-boundary samples
 * separately measure whether segmented cells remain visually distinguishable.
 */
export function measureCinema2InterlockFixtureReadability(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  patternId: Cinema2InterlockPatternId,
  dpr = 1,
): Cinema2InterlockFixtureReadabilityMetrics {
  if (width <= 0 || height <= 0 || pixels.length !== width * height * 4) {
    throw new Error('Interlock fixture readability requires RGBA pixels matching positive dimensions.')
  }

  const layout = resolveCinema2InterlockLayout(patternId, { width, height, dpr })
  let sampleCount = 0
  let visibleSampleCount = 0
  let visibleFixtureCount = 0
  let coreLuminanceSum = 0
  let localBackgroundLuminanceSum = 0
  let separationSum = 0
  let maxCoreBackgroundSeparation = 0
  let longitudinalEdgeCount = 0
  let highContrastLongitudinalEdgeCount = 0
  let segmentGapSampleCount = 0
  let readableSegmentGapCount = 0
  let segmentGapContrastSum = 0
  const authoredFixtureById = new Map(CINEMA2_INTERLOCK_RIG.fixtures.map(fixture => [fixture.id, fixture] as const))

  for (const fixture of layout.fixtures) {
    const dx = fixture.bottom[0] - fixture.top[0]
    const dy = fixture.bottom[1] - fixture.top[1]
    const length = Math.max(1e-6, Math.hypot(dx, dy))
    const nx = -dy / length
    const ny = dx / length
    const dimensions = resolveCinema2InterlockRendererInstanceDimensions(fixture.lengthPx, fixture.thicknessPx)
    const coreOffset = Math.max(0.5, dimensions.halfThicknessPx * 0.28)
    const backgroundOffset = dimensions.renderedHalfThicknessPx + Math.max(2, dpr * 1.5)
    let fixtureVisibleSamples = 0
    let fixtureSeparationSum = 0

    for (const t of [0.08, 0.17, 0.26, 0.35, 0.44, 0.53, 0.62, 0.71, 0.80, 0.89, 0.96]) {
      const cx = fixture.top[0] + dx * t
      const cy = fixture.top[1] + dy * t
      const core = averageLuminanceAt(pixels, width, height, [
        [cx, cy],
        [cx + nx * coreOffset, cy + ny * coreOffset],
        [cx - nx * coreOffset, cy - ny * coreOffset],
      ])
      const sideA = pixelLuminanceAt(pixels, width, height, cx + nx * backgroundOffset, cy + ny * backgroundOffset)
      const sideB = pixelLuminanceAt(pixels, width, height, cx - nx * backgroundOffset, cy - ny * backgroundOffset)
      const localBackground = Math.max(sideA, sideB)
      const separation = Math.max(0, core - localBackground)

      sampleCount += 1
      coreLuminanceSum += core
      localBackgroundLuminanceSum += localBackground
      separationSum += separation
      fixtureSeparationSum += separation
      maxCoreBackgroundSeparation = Math.max(maxCoreBackgroundSeparation, separation)
      if (separation >= 0.006 && core >= 0.018) {
        visibleSampleCount += 1
        fixtureVisibleSamples += 1
      }
    }

    const structuralSamples = 11
    const fixtureMeanSeparation = fixtureSeparationSum / structuralSamples
    if (fixtureVisibleSamples >= 2 || fixtureMeanSeparation >= 0.0045) visibleFixtureCount += 1

    // Dense centerline sampling is a general contrast diagnostic. The explicit
    // authored cell-boundary sampling below is the fixture-aware segment-gap check.
    let previous: number | null = null
    for (let index = 0; index < 97; index += 1) {
      const t = 0.015 + (0.97 * index / 96)
      const cx = fixture.top[0] + dx * t
      const cy = fixture.top[1] + dy * t
      const current = pixelLuminanceAt(pixels, width, height, cx, cy)
      if (previous != null) {
        longitudinalEdgeCount += 1
        if (Math.abs(current - previous) >= 0.018) highContrastLongitudinalEdgeCount += 1
      }
      previous = current
    }

    const authoredFixture = authoredFixtureById.get(fixture.fixtureId)
    if (authoredFixture) {
      const cellCount = resolveCinema2InterlockCellCount(authoredFixture)
      for (let boundaryIndex = 1; boundaryIndex < cellCount; boundaryIndex += 1) {
        const boundaryT = boundaryIndex / cellCount
        const leftCenterT = (boundaryIndex - 0.5) / cellCount
        const rightCenterT = (boundaryIndex + 0.5) / cellCount
        const gap = averageLuminanceAt(pixels, width, height, [
          [fixture.top[0] + dx * boundaryT, fixture.top[1] + dy * boundaryT],
          [fixture.top[0] + dx * boundaryT + nx * coreOffset, fixture.top[1] + dy * boundaryT + ny * coreOffset],
          [fixture.top[0] + dx * boundaryT - nx * coreOffset, fixture.top[1] + dy * boundaryT - ny * coreOffset],
        ])
        const leftCell = pixelLuminanceAt(pixels, width, height, fixture.top[0] + dx * leftCenterT, fixture.top[1] + dy * leftCenterT)
        const rightCell = pixelLuminanceAt(pixels, width, height, fixture.top[0] + dx * rightCenterT, fixture.top[1] + dy * rightCenterT)
        const neighboringCell = Math.max(leftCell, rightCell)
        const gapContrast = Math.max(0, neighboringCell - gap)
        segmentGapSampleCount += 1
        segmentGapContrastSum += gapContrast
        if (neighboringCell >= 0.015 && gapContrast >= 0.004) readableSegmentGapCount += 1
      }
    }
  }

  return {
    fixtureCount: layout.fixtures.length,
    visibleFixtureCount,
    visibleFixtureRatio: layout.fixtures.length > 0 ? visibleFixtureCount / layout.fixtures.length : 0,
    sampleCount,
    visibleSampleCount,
    visibleSampleRatio: sampleCount > 0 ? visibleSampleCount / sampleCount : 0,
    meanCoreLuminance: sampleCount > 0 ? coreLuminanceSum / sampleCount : 0,
    meanLocalBackgroundLuminance: sampleCount > 0 ? localBackgroundLuminanceSum / sampleCount : 0,
    meanCoreBackgroundSeparation: sampleCount > 0 ? separationSum / sampleCount : 0,
    maxCoreBackgroundSeparation,
    longitudinalEdgeCount,
    highContrastLongitudinalEdgeCount,
    segmentGapSampleCount,
    readableSegmentGapCount,
    meanSegmentGapContrast: segmentGapSampleCount > 0 ? segmentGapContrastSum / segmentGapSampleCount : 0,
    segmentGapContrastRatio: segmentGapSampleCount > 0 ? readableSegmentGapCount / segmentGapSampleCount : 0,
  }
}

export function isCinema2InterlockFixtureReadable(metrics: Readonly<Cinema2InterlockFixtureReadabilityMetrics>): boolean {
  return metrics.fixtureCount === CINEMA2_INTERLOCK_FIXTURE_COUNT
    && metrics.visibleFixtureCount >= 26
    && metrics.visibleSampleRatio >= 0.18
    && metrics.meanCoreBackgroundSeparation >= 0.004
    && metrics.maxCoreBackgroundSeparation >= 0.025
}

export interface Cinema2InterlockFixtureDifferenceMetrics {
  sampleCount: number
  changedSampleCount: number
  changedSampleRatio: number
  meanAbsoluteLuminanceDelta: number
  maxLuminanceDelta: number
  changedFixtureCount: number
}

export function compareCinema2InterlockFixtureSamples(
  before: ArrayLike<number>,
  after: ArrayLike<number>,
  width: number,
  height: number,
  patternId: Cinema2InterlockPatternId,
  dpr = 1,
  changedLuminanceThreshold = 0.035,
): Cinema2InterlockFixtureDifferenceMetrics {
  if (before.length !== after.length || before.length !== width * height * 4) {
    throw new Error('Interlock fixture comparison requires equal RGBA buffers matching the supplied dimensions.')
  }
  const layout = resolveCinema2InterlockLayout(patternId, { width, height, dpr })
  let sampleCount = 0
  let changedSampleCount = 0
  let deltaSum = 0
  let maxLuminanceDelta = 0
  let changedFixtureCount = 0

  for (const fixture of layout.fixtures) {
    const dx = fixture.bottom[0] - fixture.top[0]
    const dy = fixture.bottom[1] - fixture.top[1]
    const length = Math.max(1e-6, Math.hypot(dx, dy))
    const nx = -dy / length
    const ny = dx / length
    const cross = Math.max(1, fixture.thicknessPx * 0.22)
    let fixtureChanged = false
    for (const t of [0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86]) {
      const cx = fixture.top[0] + dx * t
      const cy = fixture.top[1] + dy * t
      for (const offset of [-cross, 0, cross]) {
        const x = Math.max(0, Math.min(width - 1, Math.round(cx + nx * offset)))
        const y = Math.max(0, Math.min(height - 1, Math.round(cy + ny * offset)))
        const pixelOffset = (y * width + x) * 4
        const beforeLuma = luminance(clampByte(before[pixelOffset]), clampByte(before[pixelOffset + 1]), clampByte(before[pixelOffset + 2]))
        const afterLuma = luminance(clampByte(after[pixelOffset]), clampByte(after[pixelOffset + 1]), clampByte(after[pixelOffset + 2]))
        const delta = Math.abs(afterLuma - beforeLuma)
        sampleCount += 1
        deltaSum += delta
        maxLuminanceDelta = Math.max(maxLuminanceDelta, delta)
        if (delta >= changedLuminanceThreshold) {
          changedSampleCount += 1
          fixtureChanged = true
        }
      }
    }
    if (fixtureChanged) changedFixtureCount += 1
  }

  return {
    sampleCount,
    changedSampleCount,
    changedSampleRatio: sampleCount > 0 ? changedSampleCount / sampleCount : 0,
    meanAbsoluteLuminanceDelta: sampleCount > 0 ? deltaSum / sampleCount : 0,
    maxLuminanceDelta,
    changedFixtureCount,
  }
}

export function isCinema2InterlockFixtureDifferenceVisible(metrics: Readonly<Cinema2InterlockFixtureDifferenceMetrics>): boolean {
  return metrics.sampleCount > 0
    && metrics.changedFixtureCount >= 8
    && metrics.changedSampleRatio >= 0.08
    && metrics.maxLuminanceDelta >= 0.08
}

function pixelLuminanceAt(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const px = Math.max(0, Math.min(width - 1, Math.round(x)))
  const py = Math.max(0, Math.min(height - 1, Math.round(y)))
  const offset = (py * width + px) * 4
  return luminance(clampByte(pixels[offset]), clampByte(pixels[offset + 1]), clampByte(pixels[offset + 2]))
}

function averageLuminanceAt(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  points: readonly (readonly [number, number])[],
): number {
  if (points.length === 0) return 0
  let sum = 0
  for (const [x, y] of points) sum += pixelLuminanceAt(pixels, width, height, x, y)
  return sum / points.length
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
