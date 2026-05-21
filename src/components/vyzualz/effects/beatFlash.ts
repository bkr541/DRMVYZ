import type { VzEffectModule, VzFrameContext } from './types'

// ── Beat Flash ────────────────────────────────────────────────────────────────
// A brief white flash + outward teal ring on each beat boundary.
// Only fires at onBeatBoundary; decays within the first 4% of the beat period.
//
// Future deeper params: flashColor, ringColor, decayRate, ringRadiusMin/Max.

interface BeatFlashParams extends Record<string, unknown> {
  amount: number
}

export const beatFlashModule: VzEffectModule<BeatFlashParams> = {
  id:          'beatFlash',
  label:       'Beat Flash',
  category:    'audioReactive',
  renderPhase: 'master',
  chainName:   'Beat Flash',
  effectKey:   'beatFlash',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: BeatFlashParams) {
    const { W, H, cx, cy, beatPhase, onBeatBoundary } = frame
    const { amount } = params
    if (amount <= 0 || !onBeatBoundary) return

    const decay = 1 - beatPhase / 0.04

    // White flash
    ctx.fillStyle = `rgba(255,255,255,${amount * 0.18 * decay})`
    ctx.fillRect(0, 0, W, H)

    // Teal ring
    const minDim = Math.min(W, H)
    const ring = ctx.createRadialGradient(cx, cy, minDim * 0.28, cx, cy, minDim * 0.54)
    ring.addColorStop(0, 'rgba(74,199,219,0)')
    ring.addColorStop(1, `rgba(74,199,219,${0.38 * decay * amount})`)
    ctx.fillStyle = ring
    ctx.fillRect(0, 0, W, H)
  },
}
