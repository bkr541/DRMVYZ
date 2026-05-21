import type { VzEffectModule, VzFrameContext } from './types'
import { updateAndDrawParticles } from '../visualEffects'
import { resolveParticleBurstParams } from '../../../types/effectParams'
import type { BurstParticle } from '../visualEffects'

interface ParticleBurstParams extends Record<string, unknown> {
  amount: number
}

const particleBurstStateMap = new WeakMap<CanvasRenderingContext2D, { particles: BurstParticle[] }>()

export const particleBurstModule: VzEffectModule<ParticleBurstParams> = {
  id:          'particleBurst',
  label:       'Particle Burst',
  category:    'audioReactive',
  renderPhase: 'postMedia',
  chainName:   'Particle Burst',
  effectKey:   'particleBurst',
  defaultParams: { amount: 0.5 },

  draw(ctx: CanvasRenderingContext2D, frame: VzFrameContext, params: ParticleBurstParams) {
    let state = particleBurstStateMap.get(ctx)
    if (!state) { state = { particles: [] }; particleBurstStateMap.set(ctx, state) }
    const { W, H, dpr, audio: { bass }, beatHit, effectParams } = frame
    const { maxParticles } = resolveParticleBurstParams(effectParams)
    updateAndDrawParticles(ctx, W, H, dpr, state.particles, params.amount, bass, beatHit, maxParticles)
  },
}
