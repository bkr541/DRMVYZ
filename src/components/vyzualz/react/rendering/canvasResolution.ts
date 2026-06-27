import type { QualityTierWithAuto } from '../shaders/performance/shaderPerformanceTypes'

export type CanvasQualityMode = QualityTierWithAuto

/** UHD/4K backing-buffer budget. Large enough for native 4K, bounded for live use. */
export const MAX_CANVAS_BACKING_PIXELS = 3840 * 2160
/** Conservative cross-device texture/canvas edge ceiling. */
export const MAX_CANVAS_BACKING_DIMENSION = 8192
/** Ignore one-pixel backing-size chatter from fractional ResizeObserver values. */
export const CANVAS_RESIZE_HYSTERESIS_PX = 1

export const CANVAS_DPR_CEILINGS: Readonly<Record<CanvasQualityMode, number>> = {
  low:    1,
  medium: 1.25,
  high:   1.5,
  ultra:  2,
  auto:   1.5,
}

export interface CanvasResolution {
  valid:                boolean
  cssWidth:             number
  cssHeight:            number
  backingWidth:         number
  backingHeight:        number
  effectiveDpr:         number
  resolutionScale:      number
  quality:              CanvasQualityMode
  cappedByDpr:          boolean
  cappedByPixelBudget:  boolean
  cappedByDimension:    boolean
}

export interface ResolveCanvasResolutionOptions {
  cssWidth:             number
  cssHeight:            number
  devicePixelRatio?:    number
  quality?:             CanvasQualityMode
  resolutionScale?:     number
  maxPixelCount?:       number
  maxDimension?:        number
  previous?:            CanvasResolution | null
}

function finitePositive(value: number | undefined, fallback: number): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : fallback
}

function finalizeDimensions(
  cssWidth: number,
  cssHeight: number,
  backingScale: number,
  maxPixelCount: number,
  maxDimension: number,
): { width: number; height: number } {
  let width  = Math.max(1, Math.min(maxDimension, Math.round(cssWidth  * backingScale)))
  let height = Math.max(1, Math.min(maxDimension, Math.round(cssHeight * backingScale)))

  // Rounding can overshoot the exact area budget by a small amount. Correct it
  // deterministically so the returned allocation never exceeds the policy.
  if (width * height > maxPixelCount) {
    const correction = Math.sqrt(maxPixelCount / (width * height))
    width  = Math.max(1, Math.floor(width  * correction))
    height = Math.max(1, Math.floor(height * correction))
  }

  while (width * height > maxPixelCount) {
    if (width >= height && width > 1) width--
    else if (height > 1) height--
    else break
  }

  return { width, height }
}

/**
 * Resolve a safe canvas backing-store size without changing its CSS layout size.
 *
 * The quality tier caps DPR, then a hard pixel budget and edge limit cap the
 * final backing dimensions after the renderer's internal resolution scale.
 */
export function resolveCanvasResolution({
  cssWidth,
  cssHeight,
  devicePixelRatio = 1,
  quality = 'high',
  resolutionScale = 1,
  maxPixelCount = MAX_CANVAS_BACKING_PIXELS,
  maxDimension = MAX_CANVAS_BACKING_DIMENSION,
  previous = null,
}: ResolveCanvasResolutionOptions): CanvasResolution {
  if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0) {
    return {
      valid: false,
      cssWidth: 0,
      cssHeight: 0,
      backingWidth: 0,
      backingHeight: 0,
      effectiveDpr: 1,
      resolutionScale: finitePositive(resolutionScale, 1),
      quality,
      cappedByDpr: false,
      cappedByPixelBudget: false,
      cappedByDimension: false,
    }
  }

  const safeDpr       = finitePositive(devicePixelRatio, 1)
  const safeScale     = Math.min(1, finitePositive(resolutionScale, 1))
  const safeMaxPixels = Math.max(1, Math.floor(finitePositive(maxPixelCount, MAX_CANVAS_BACKING_PIXELS)))
  const safeMaxDim    = Math.max(1, Math.floor(finitePositive(maxDimension, MAX_CANVAS_BACKING_DIMENSION)))
  const dprCeiling    = CANVAS_DPR_CEILINGS[quality]
  const qualityDpr    = Math.min(safeDpr, dprCeiling)
  const requestedBackingScale = qualityDpr * safeScale

  const pixelScaleLimit = Math.sqrt(safeMaxPixels / (cssWidth * cssHeight))
  const edgeScaleLimit  = Math.min(safeMaxDim / cssWidth, safeMaxDim / cssHeight)
  const backingScale    = Math.min(requestedBackingScale, pixelScaleLimit, edgeScaleLimit)

  let { width: backingWidth, height: backingHeight } = finalizeDimensions(
    cssWidth,
    cssHeight,
    backingScale,
    safeMaxPixels,
    safeMaxDim,
  )

  // Fractional layout measurements can alternate by tiny amounts while the CSS
  // box is visually unchanged. Keep the prior integer allocation within a
  // one-pixel deadband, but never across a quality/scale policy change.
  if (
    previous?.valid &&
    previous.quality === quality &&
    Math.abs(previous.resolutionScale - safeScale) < 1e-6 &&
    previous.backingWidth <= safeMaxDim &&
    previous.backingHeight <= safeMaxDim &&
    previous.backingWidth * previous.backingHeight <= safeMaxPixels &&
    Math.abs(previous.backingWidth - backingWidth) <= CANVAS_RESIZE_HYSTERESIS_PX &&
    Math.abs(previous.backingHeight - backingHeight) <= CANVAS_RESIZE_HYSTERESIS_PX
  ) {
    backingWidth  = previous.backingWidth
    backingHeight = previous.backingHeight
  }

  const actualBackingScale = Math.min(backingWidth / cssWidth, backingHeight / cssHeight)
  const effectiveDpr       = actualBackingScale / safeScale

  return {
    valid: true,
    cssWidth,
    cssHeight,
    backingWidth,
    backingHeight,
    effectiveDpr,
    resolutionScale: safeScale,
    quality,
    cappedByDpr: safeDpr > dprCeiling,
    cappedByPixelBudget: requestedBackingScale > pixelScaleLimit,
    cappedByDimension: requestedBackingScale > edgeScaleLimit,
  }
}

/** Apply exact resolved dimensions. Returns true only when storage changed. */
export function applyCanvasResolution(
  canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
  resolution: CanvasResolution,
): boolean {
  if (!resolution.valid) return false
  if (canvas.width === resolution.backingWidth && canvas.height === resolution.backingHeight) return false
  canvas.width  = resolution.backingWidth
  canvas.height = resolution.backingHeight
  return true
}
