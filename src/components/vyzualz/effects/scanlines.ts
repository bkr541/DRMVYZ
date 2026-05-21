import type { VzEffectModule, VzFrameContext } from './types'

// ── Scanlines ─────────────────────────────────────────────────────────────────
// Horizontal black stripes at a quality-controlled pixel stride.
// Mimics CRT phosphor banding; amount drives the stripe opacity.
//
// Future deeper params: strideOverride, color, blendMode.

interface ScanlinesParams extends Record<string, unknown> {
  amount: number
}

export const scanlinesModule: VzEffectModule<ScanlinesParams> = {
  id:          'scanlines',
  label:       'Scanlines',
  category:    'post',
  renderPhase: 'master',
  chainName:   'Scanlines',
  effectKey:   'scanlines',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: ScanlinesParams) {
    const { W, H, quality } = frame
    const { amount } = params
    if (amount <= 0) return
    ctx.fillStyle = `rgba(0,0,0,${amount * 0.17})`
    for (let y = 0; y < H; y += quality.scanlineStep) ctx.fillRect(0, y, W, 1)
  },
}
