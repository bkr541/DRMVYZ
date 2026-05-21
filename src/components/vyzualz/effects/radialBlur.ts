import type { VzEffectModule, VzFrameContext } from './types'
import { drawRadialBlur } from '../visualEffects'

// ── Radial Blur ───────────────────────────────────────────────────────────────
// Scaled transparent copies expanding from the canvas center; bass drives spread.
//
// Future deeper params: steps (currently 5), maxScaleMultiplier, blendMode.

interface RadialBlurParams extends Record<string, unknown> {
  amount: number
}

export const radialBlurModule: VzEffectModule<RadialBlurParams> = {
  id:          'radialBlur',
  label:       'Radial Blur',
  category:    'distortion',
  renderPhase: 'postMedia',
  chainName:   'Radial Blur',
  effectKey:   'radialBlur',
  defaultParams: { amount: 0.4 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: RadialBlurParams) {
    drawRadialBlur(ctx, frame.W, frame.H, params.amount, frame.audio.bass)
  },
}
