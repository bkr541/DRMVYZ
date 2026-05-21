import type { VzEffectModule, VzFrameContext } from './types'

// ── Edge Flicker ──────────────────────────────────────────────────────────────
// A high-frequency-driven radial vignette that shimmers at the canvas edge.
// Only fires when high-band energy × masterIntensity exceeds 0.15.
//
// Future deeper params: color, innerRadius, outerRadius, threshold.

interface EdgeFlickerParams extends Record<string, unknown> {
  amount: number
}

export const edgeFlickerModule: VzEffectModule<EdgeFlickerParams> = {
  id:          'edgeFlicker',
  label:       'Edge Flicker',
  category:    'audioReactive',
  renderPhase: 'master',
  chainName:   'Edge Flicker',
  effectKey:   'edgeFlicker',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: EdgeFlickerParams) {
    const { W, H, cx, cy, audio, masterIntensity } = frame
    const { amount } = params
    if (amount <= 0) return

    const edgeDrive = audio.high * masterIntensity
    if (edgeDrive <= 0.15) return

    const flickerAlpha = (edgeDrive - 0.15) * amount * 0.45
    const minDim = Math.min(W, H)
    const grad = ctx.createRadialGradient(cx, cy, minDim * 0.3, cx, cy, minDim * 0.55)
    grad.addColorStop(0, 'rgba(74,199,219,0)')
    grad.addColorStop(1, `rgba(74,199,219,${flickerAlpha})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  },
}
