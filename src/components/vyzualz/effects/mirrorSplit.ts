import type { VzEffectModule, VzFrameContext } from './types'
import { drawMirrorSplit } from '../visualEffects'

// ── Mirror Split ──────────────────────────────────────────────────────────────
// Horizontal (and at high intensity: vertical) canvas mirror blended with 'screen'.
//
// Future deeper params: axis ('horizontal'|'vertical'|'both'), blendAlpha.

interface MirrorSplitParams extends Record<string, unknown> {
  amount: number
}

export const mirrorSplitModule: VzEffectModule<MirrorSplitParams> = {
  id:          'mirrorSplit',
  label:       'Mirror Split',
  category:    'distortion',
  renderPhase: 'postMedia',
  chainName:   'Mirror Split',
  effectKey:   'mirrorSplit',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: MirrorSplitParams) {
    drawMirrorSplit(ctx, frame.W, frame.H, params.amount)
  },
}
