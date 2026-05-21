import type { VzEffectModule, VzFrameContext } from './types'
import { drawEdgeGlow } from '../visualEffects'

// ── Edge Glow ─────────────────────────────────────────────────────────────────
// Radial teal glow around the canvas boundary; reacts to volume and highs.
//
// Future deeper params: glowColor, innerFraction, outerFraction.

interface EdgeGlowParams extends Record<string, unknown> {
  amount: number
}

export const edgeGlowModule: VzEffectModule<EdgeGlowParams> = {
  id:          'edgeGlow',
  label:       'Edge Glow',
  category:    'audioReactive',
  renderPhase: 'postMedia',
  chainName:   'Edge Glow',
  effectKey:   'edgeGlow',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: EdgeGlowParams) {
    drawEdgeGlow(ctx, frame.W, frame.H, params.amount, frame.audio.volume, frame.audio.high)
  },
}
