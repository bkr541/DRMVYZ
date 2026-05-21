import type { VzEffectModule, VzFrameContext } from './types'
import { drawKaleidoscope } from '../visualEffects'

// ── Kaleidoscope ──────────────────────────────────────────────────────────────
// Rotated + mirrored copies of the current canvas blended with 'screen'.
//
// Future deeper params: segments (currently 6), rotationOffset, blendMode.

interface KaleidoscopeParams extends Record<string, unknown> {
  amount: number
}

export const kaleidoscopeModule: VzEffectModule<KaleidoscopeParams> = {
  id:          'kaleidoscope',
  label:       'Kaleidoscope',
  category:    'distortion',
  renderPhase: 'postMedia',
  chainName:   'Kaleidoscope',
  effectKey:   'kaleidoscope',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: KaleidoscopeParams) {
    drawKaleidoscope(ctx, frame.W, frame.H, params.amount)
  },
}
