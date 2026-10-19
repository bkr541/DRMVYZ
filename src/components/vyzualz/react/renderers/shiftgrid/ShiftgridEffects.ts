import type { CanvasShiftgridSettings } from './ShiftgridSettings'

export interface ShiftgridEffectAudio {
  readonly edgeShimmer: number
  readonly gridPulse: number
  readonly snapAccent: number
}

export interface ShiftgridEffectPlan {
  readonly edgeGlow: number
  readonly lightTrails: number
  readonly motionBlur: number
  readonly rgbSeparation: number
  readonly beatPulse: number
  readonly snapFlash: number
  readonly tileGap: number
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

export const CLEAN_SHIFTGRID_EFFECT_PLAN: ShiftgridEffectPlan = Object.freeze({
  edgeGlow: 0,
  lightTrails: 0,
  motionBlur: 0,
  rgbSeparation: 0,
  beatPulse: 0,
  snapFlash: 0,
  tileGap: 0,
})

/** Resolves durable effect preferences and transient audio accents without mutating either. */
export function resolveShiftgridEffectPlan(
  settings: CanvasShiftgridSettings,
  audio: ShiftgridEffectAudio | null,
): ShiftgridEffectPlan {
  if (!settings.enhancedEffects) return CLEAN_SHIFTGRID_EFFECT_PLAN
  const performanceStrength = clamp01(settings.masterIntensity)
  const edgeAccent = settings.tileEdgeGlowEnabled ? clamp01(audio?.edgeShimmer ?? 0) : 0
  return Object.freeze({
    edgeGlow: settings.tileEdgeGlowEnabled
      ? clamp01(settings.edgeGlow * (0.45 + performanceStrength * 0.55) + edgeAccent * settings.edgeGlow * 0.35)
      : 0,
    lightTrails: settings.lightTrailsEnabled ? clamp01(settings.lightTrails * performanceStrength) : 0,
    motionBlur: settings.motionBlurEnabled ? clamp01(settings.motionBlur * performanceStrength * clamp01(settings.movementSpeed / 2)) : 0,
    rgbSeparation: settings.rgbSeparationEnabled ? clamp01(settings.chromaticSplit * performanceStrength) : 0,
    beatPulse: settings.beatPulseEnabled ? clamp01(settings.beatPulse * (audio?.gridPulse ?? 0) * performanceStrength) : 0,
    snapFlash: settings.snapFlashEnabled
      ? clamp01(settings.snapFlash * (0.7 + clamp01(audio?.snapAccent ?? 0) * 0.3) * performanceStrength)
      : 0,
    // A user-authored gap is layout styling, so Master Intensity never changes it.
    tileGap: settings.tileGapEnabled ? clamp01(settings.tileGap) : 0,
  })
}
