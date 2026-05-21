import type { VzEffectModule, VzFrameContext } from './types'
import { drawReactiveGrid } from '../visualEffects'

interface ReactiveGridParams extends Record<string, unknown> {
  amount: number
}

export const reactiveGridModule: VzEffectModule<ReactiveGridParams> = {
  id:          'reactiveGrid',
  label:       'Reactive Grid',
  category:    'generative',
  renderPhase: 'preMedia',
  chainName:   'Reactive Grid',
  effectKey:   'reactiveGrid',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: ReactiveGridParams) {
    const { W, H, dpr, time, audio: { bass, lowMid } } = frame
    drawReactiveGrid(ctx, W, H, dpr, time, params.amount, bass, lowMid)
  },
}
