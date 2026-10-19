import type { ShiftgridAudioFrame } from './ShiftgridAudioIntelligence'
import type { CanvasShiftgridSettings } from './ShiftgridSettings'

export interface ShiftgridEffectPlan {
  depth: number
  edgeGlow: number
  chromaticSplit: number
  motionBlur: number
  edgeFeather: number
  renderScale: number
  tileBudget: number
}

/** Semantic effect plan shared by the future Canvas2D/WebGL implementations. */
export function resolveShiftgridEffectPlan(
  settings: CanvasShiftgridSettings,
  audio: Pick<ShiftgridAudioFrame, 'bass' | 'transient' | 'energy'> | null,
): ShiftgridEffectPlan {
  const audioLift = audio ? Math.min(1, audio.bass * 0.45 + audio.transient * 0.35 + audio.energy * 0.2) : 0
  const enabled = settings.enhancedEffects ? 1 : 0
  return Object.freeze({
    depth: Math.min(1, settings.depthAmount * enabled * (1 + audioLift * 0.25)),
    edgeGlow: Math.min(1, settings.edgeGlow * enabled * (1 + audioLift * 0.5)),
    chromaticSplit: Math.min(1, settings.chromaticSplit * enabled * (1 + audioLift)),
    motionBlur: settings.motionBlur * enabled,
    edgeFeather: settings.edgeFeather,
    renderScale: settings.renderScale,
    tileBudget: settings.tileBudget,
  })
}
