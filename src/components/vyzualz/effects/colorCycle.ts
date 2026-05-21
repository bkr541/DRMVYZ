import type { VzEffectModule, VzFrameContext } from './types'
import { drawColorCycle } from '../visualEffects'

// ── Color Cycle ───────────────────────────────────────────────────────────────
// Slowly rotating hue-gradient overlay; speed reacts to mid and volume.
// Persistent hue state is stored per-ctx in a WeakMap so no ref needs
// to be threaded through the component tree.
//
// Future deeper params: baseHue, hueRange, speedMultiplier.

interface ColorCycleParams extends Record<string, unknown> {
  amount: number
}

// Per-canvas mutable hue state — lives as long as the ctx does.
const hueState = new WeakMap<CanvasRenderingContext2D, { current: number }>()

export const colorCycleModule: VzEffectModule<ColorCycleParams> = {
  id:          'colorCycle',
  label:       'Color Cycle',
  category:    'color',
  renderPhase: 'postMedia',
  chainName:   'Color Cycle',
  effectKey:   'colorCycle',
  defaultParams: { amount: 0.45 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: ColorCycleParams) {
    if (!hueState.has(ctx)) hueState.set(ctx, { current: 0 })
    const hueRef = hueState.get(ctx)!
    drawColorCycle(ctx, frame.W, frame.H, hueRef, params.amount, frame.audio.mid, frame.audio.volume)
  },
}
