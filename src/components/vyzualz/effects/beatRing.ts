import type { VzEffectModule, VzFrameContext } from './types'
import { updateAndDrawBeatRings } from '../visualEffects'
import type { BeatRing } from '../visualEffects'

interface BeatRingParams extends Record<string, unknown> {
  amount: number
}

const beatRingStateMap = new WeakMap<CanvasRenderingContext2D, { rings: BeatRing[] }>()

export const beatRingModule: VzEffectModule<BeatRingParams> = {
  id:          'beatRing',
  label:       'Beat Ring',
  category:    'audioReactive',
  renderPhase: 'postMedia',
  chainName:   'Beat Ring',
  effectKey:   'beatRing',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: BeatRingParams) {
    let state = beatRingStateMap.get(ctx)
    if (!state) { state = { rings: [] }; beatRingStateMap.set(ctx, state) }
    const { W, H, dpr, audio: { bass }, beatHit } = frame
    updateAndDrawBeatRings(ctx, W, H, dpr, state.rings, params.amount, bass, beatHit)
  },
}
