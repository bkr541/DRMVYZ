import type { PixGridQualityTier, PixGridRendererPath, PixGridState } from './PixGridTypes'
import { resolvePixGridMatrixDimensions } from './PixGridDefaults'
import type { PixGridAdaptiveQualityProfile } from './PixGridAdaptiveQuality'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

/**
 * Canonical PixGrid presentation hierarchy.
 *
 * Persisted compatibility fields keep their existing storage names, while the
 * UI and renderer contracts assign each one a single scope:
 * - globalIntensity: primary Output Intensity
 * - frame intensity: Authored Performance Trim
 * - cellBrightness: advanced Cell Calibration
 * - glowAmount: emitter Glow strength
 * - frame glow: Halo Radius
 * - diffusion: emitter edge diffusion
 */
export interface PixGridResolvedPresentation {
  outputIntensity: number
  authoredPerformanceTrim: number
  cellCalibration: number
  resolvedOutputIntensity: number
  glow: number
  haloRadius: number
  diffusion: number
}

export function resolvePixGridPresentation(
  state: Pick<PixGridState, 'globalIntensity' | 'cellBrightness' | 'glowAmount' | 'diffusion'>,
  frame: Pick<{ intensity: number; glow: number }, 'intensity' | 'glow'>,
): PixGridResolvedPresentation {
  const outputIntensity = clamp01(state.globalIntensity)
  const authoredPerformanceTrim = clamp01(frame.intensity)
  const cellCalibration = clamp01(state.cellBrightness)
  return {
    outputIntensity,
    authoredPerformanceTrim,
    cellCalibration,
    resolvedOutputIntensity: clamp01(outputIntensity * authoredPerformanceTrim * cellCalibration),
    glow: clamp01(state.glowAmount),
    haloRadius: clamp01(frame.glow),
    diffusion: clamp01(state.diffusion),
  }
}

export type PixGridQualityPromotionSource = 'adaptive-controller' | 'canvas2d-fallback' | null

export interface PixGridResolvedQualityPublication {
  requestedQuality: PixGridQualityTier
  effectiveQuality: PixGridQualityTier
  logicalWidth: number
  logicalHeight: number
  promotionSource: PixGridQualityPromotionSource
  promotionReason: string | null
}

export function resolvePixGridPublishedQuality(
  requestedQuality: PixGridQualityTier,
  profile: PixGridAdaptiveQualityProfile,
  path: PixGridRendererPath,
): PixGridResolvedQualityPublication {
  let effectiveQuality = profile.logicalQuality
  let promotionSource: PixGridQualityPromotionSource = null
  let promotionReason: string | null = null

  if (requestedQuality === 'draft' && profile.logicalQuality === 'low') {
    promotionSource = 'adaptive-controller'
    promotionReason = 'Adaptive Quality promotes Draft to the 96 × 54 safety floor.'
  }
  if (path === 'canvas2d-fallback' && effectiveQuality === 'draft') {
    effectiveQuality = 'low'
    promotionSource = 'canvas2d-fallback'
    promotionReason = 'Canvas2D fallback promotes Draft to Low for stable logical-frame composition.'
  }

  const dimensions = resolvePixGridMatrixDimensions(effectiveQuality)
  return {
    requestedQuality,
    effectiveQuality,
    logicalWidth: dimensions.width,
    logicalHeight: dimensions.height,
    promotionSource,
    promotionReason,
  }
}
