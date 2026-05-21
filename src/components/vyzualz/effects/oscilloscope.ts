import type { VzEffectModule, VzFrameContext } from './types'
import { drawOscilloscope } from '../visualEffects'

interface OscilloscopeParams extends Record<string, unknown> {
  amount: number
}

export const oscilloscopeModule: VzEffectModule<OscilloscopeParams> = {
  id:          'oscilloscope',
  label:       'Oscilloscope',
  category:    'audioReactive',
  renderPhase: 'postMedia',
  chainName:   'Oscilloscope',
  effectKey:   'oscilloscope',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: OscilloscopeParams) {
    const { W, H, dpr, timeDomainData, audio: { volume, mid, high }, time } = frame
    drawOscilloscope(ctx, W, H, dpr, timeDomainData, params.amount, volume, mid, high, time)
  },
}
