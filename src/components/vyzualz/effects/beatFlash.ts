import type { VzEffectModule, VzFrameContext } from './types'

// ── Beat Flash ────────────────────────────────────────────────────────────────
// A brief white flash + outward teal ring at each beat boundary (synced mode only).
// Decays within the first `decay` fraction of the beat period.
// Respects masterIntensity and a per-second safety cap.
//
// flashColor: CSS rgb triplet for the screen-wide flash
// ringColor:  CSS rgb triplet for the radial gradient ring
// decay:      fraction of the beat period over which the flash fades (default 0.04)
// safetyCap:  maximum flashes per second (photosensitivity limiter; 0 = no cap)

interface BeatFlashParams extends Record<string, unknown> {
  amount:     number
  flashColor: string
  ringColor:  string
  decay:      number
  safetyCap:  number
}

export const beatFlashModule: VzEffectModule<BeatFlashParams> = {
  id:          'beatFlash',
  label:       'Beat Flash',
  category:    'audioReactive',
  renderPhase: 'master',
  chainName:   'Beat Flash',
  effectKey:   'beatFlash',
  defaultParams: {
    amount:     0.5,
    flashColor: '255,255,255',
    ringColor:  '74,199,219',
    decay:      0.04,
    safetyCap:  3,
  },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: BeatFlashParams) {
    const { W, H, cx, cy, beatPhase, onBeatBoundary, bpm, masterIntensity } = frame
    const { amount, flashColor, ringColor, decay, safetyCap } = params

    // Only fires at a synced beat boundary
    if (!onBeatBoundary) return

    // Must have some output intensity
    if (masterIntensity <= 0) return

    // Safety cap: if BPM would cause more flashes/sec than allowed, skip
    if (safetyCap > 0 && bpm > 0 && (bpm / 60) > safetyCap) return

    const decayWindow = Math.max(0.01, decay)
    const t = Math.max(0, 1 - beatPhase / decayWindow)

    const flashAlpha = amount * masterIntensity * 0.18 * t
    if (flashAlpha <= 0) return

    // Screen-wide white flash
    ctx.fillStyle = `rgba(${flashColor},${flashAlpha})`
    ctx.fillRect(0, 0, W, H)

    // Radial ring expanding from center
    const minDim = Math.min(W, H)
    const ring = ctx.createRadialGradient(cx, cy, minDim * 0.28, cx, cy, minDim * 0.54)
    ring.addColorStop(0, `rgba(${ringColor},0)`)
    ring.addColorStop(1, `rgba(${ringColor},${0.38 * t * amount * masterIntensity})`)
    ctx.fillStyle = ring
    ctx.fillRect(0, 0, W, H)
  },
}
