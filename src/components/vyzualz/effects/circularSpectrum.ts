import type { VzEffectModule, VzFrameContext } from './types'
import { drawCircularSpectrum } from '../visualEffects'

interface CircularSpectrumParams extends Record<string, unknown> {
  amount: number
}

export const circularSpectrumModule: VzEffectModule<CircularSpectrumParams> = {
  id:          'circularSpectrum',
  label:       'Circular Spectrum',
  category:    'audioReactive',
  renderPhase: 'postMedia',
  chainName:   'Circular Spectrum',
  effectKey:   'circularSpectrum',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: CircularSpectrumParams) {
    const { W, H, dpr, freqData, audio: { bass } } = frame
    if (!freqData) return
    drawCircularSpectrum(ctx, W, H, dpr, freqData, params.amount, bass)
  },
}
