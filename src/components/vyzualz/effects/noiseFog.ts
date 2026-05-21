import type { VzEffectModule, VzFrameContext } from './types'
import { resolveNoiseFogParams } from '../../../types/effectParams'

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
    const { W, H, quality, effectParams } = frame
    const { amount } = params
    if (amount < 0.02) return

    const np = resolveNoiseFogParams(effectParams)
    const baseCount = np.particleCount > 0 ? np.particleCount : quality.fogParticles
    const count = Math.max(0, Math.round(baseCount * np.qualityMultiplier))
    if (count < 1) return

    ctx.save()
    ctx.globalAlpha = amount * 0.12
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = `rgba(74,199,219,${Math.random()})`
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  },
}
