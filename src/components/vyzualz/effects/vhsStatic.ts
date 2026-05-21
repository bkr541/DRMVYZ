import type { VzEffectModule, VzFrameContext } from './types'
import { drawVhsStatic } from '../visualEffects'

// ── VHS Static ────────────────────────────────────────────────────────────────
// Analog noise dots and drifting tracking lines; delegates to the shared helper.
//
// Future deeper params: noiseDensity, lineCount, trackingSpeed.

interface VhsStaticParams extends Record<string, unknown> {
  amount: number
}

export const vhsStaticModule: VzEffectModule<VhsStaticParams> = {
  id:          'vhsStatic',
  label:       'VHS Static',
  category:    'post',
  renderPhase: 'master',
  chainName:   'VHS Static',
  effectKey:   'vhsStatic',
  defaultParams: { amount: 0.35 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: VhsStaticParams) {
    drawVhsStatic(ctx, frame.W, frame.H, params.amount, frame.time)
  },
}
