import type { VzEffectModule, VzFrameContext } from './types'
import { resolveStrobeParams } from '../../../types/effectParams'

// ── Strobe ────────────────────────────────────────────────────────────────────
// Fires a full-screen white flash on beat boundaries (synced) or bass transients
// (free mode). Respects masterIntensity and a per-second safety cap.
//
// beatDivision: flashes per beat (1=every beat, 2=every half-beat, 0.5=every 2 beats)
// duration:     fraction of the sub-beat period the flash occupies (default 0.08)
// color:        CSS rgb triplet, e.g. "255,255,255"
// threshold:    minimum bass level to trigger in free (un-synced) mode
// safetyCap:    maximum flashes per second (photosensitivity limiter; 0 = no cap)

interface StrobeParams extends Record<string, unknown> {
  amount:       number
  beatDivision: number
  duration:     number
  color:        string
  threshold:    number
  safetyCap:    number
}

// Per-canvas free-mode rate limiter — tracks the last flash wall-clock time
const strobeState = new WeakMap<CanvasRenderingContext2D, { lastMs: number }>()

export const strobeModule: VzEffectModule<StrobeParams> = {
  id:          'strobe',
  label:       'Strobe',
  category:    'distortion',
  renderPhase: 'master',
  chainName:   'Strobe',
  effectKey:   'strobe',
  defaultParams: {
    amount:       0.5,
    beatDivision: 1,
    duration:     0.08,
    color:        '255,255,255',
    threshold:    0.62,
    safetyCap:    3,
  },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: StrobeParams) {
    const { W, H, beatPhase, onBeatBoundary, beatHit, bpm, audio: { bass }, masterIntensity, time, effectParams } = frame
    const { amount, color } = params
    // User-configured effectParams override module defaultParams for tunable fields
    const resolved = resolveStrobeParams(effectParams)
    const { beatDivision, duration, threshold, safetyCap } = resolved

    // Must have some output intensity
    if (masterIntensity <= 0) return

    // ── Synced mode: flash on beat subdivisions ──────────────────────────────
    if (onBeatBoundary || beatPhase < 0.5) {
      // Sub-phase cycles 0→1 `beatDivision` times per beat
      const subPhase = (beatPhase * Math.max(0.25, beatDivision)) % 1
      const decayWindow = Math.max(0.01, Math.min(0.25, duration))
      if (subPhase < decayWindow) {
        // Safety: reject if resulting flash rate exceeds cap
        const flashesPerSec = (bpm / 60) * Math.max(0.25, beatDivision)
        if (safetyCap > 0 && flashesPerSec > safetyCap) return

        const t = 1 - subPhase / decayWindow
        const alpha = amount * masterIntensity * t * 0.9
        if (alpha <= 0) return
        ctx.fillStyle = `rgba(${color},${alpha})`
        ctx.fillRect(0, 0, W, H)
        return
      }
    }

    // ── Free mode: bass-transient triggered ──────────────────────────────────
    if (beatHit && !onBeatBoundary && bass >= threshold) {
      // Timestamp-based rate cap for un-synced bass triggers
      const minGapMs = safetyCap > 0 ? 1000 / safetyCap : 0
      let state = strobeState.get(ctx)
      if (!state) { state = { lastMs: -Infinity }; strobeState.set(ctx, state) }
      if (minGapMs > 0 && time - state.lastMs < minGapMs) return
      state.lastMs = time

      const alpha = amount * bass * 0.85 * masterIntensity
      if (alpha <= 0) return
      ctx.fillStyle = `rgba(${color},${alpha})`
      ctx.fillRect(0, 0, W, H)
    }
  },
}
