import type { VzEffectModule, VzFrameContext } from './types'

// ── Noise Fog ─────────────────────────────────────────────────────────────────
// Scatter semi-transparent teal dots across the canvas for a hazy atmosphere.
// Dot count is quality-aware; opacity scales with amount.
//
// Future deeper params: color (rgba), density multiplier, size jitter.

interface NoiseFogParams extends Record<string, unknown> {
  amount: number
}

export const noiseFogModule: VzEffectModule<NoiseFogParams> = {
  id:          'noiseFog',
  label:       'Noise Fog',
  category:    'post',
  renderPhase: 'master',
  chainName:   'Noise Fog',
  effectKey:   'noiseFog',
  defaultParams: { amount: 0.4 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: NoiseFogParams) {
    const { W, H, quality } = frame
    const { amount } = params
    if (amount < 0.02) return
    ctx.save()
    ctx.globalAlpha = amount * 0.12
    for (let i = 0; i < quality.fogParticles; i++) {
      ctx.fillStyle = `rgba(74,199,219,${Math.random()})`
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  },
}
