import { describe, expect, it } from 'vitest'
import { psyloChoreographyHarness } from '../../../../test/support/PsyloChoreographyHarness'
import { psyloParameterId } from '../presets/Cinema2PsyloPreset'
import { cinema2AtmosphereAuthoredDelta } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { PSYLO_EFFECT_IDS } from '../presets/Cinema2PsyloFinishing'

describe('PSYLO finishing authority', () => {
  it('gates physical fog and mist together, preserving independent height and amount', () => {
    const h = psyloChoreographyHarness()
    const target = (property: string) => h.targets.find(t => t.ownerId === PSYLO_EFFECT_IDS.atmosphere && t.property === property)!
    // Access the public compiled target catalog through the harness.
    h.publish()
    const density = h.resolver.resolve(target('density').id), mist = h.resolver.resolve(target('mistAmount').id)
    expect(density.value).toBeCloseTo(.009 * .45); expect(mist.value).toBeCloseTo(.08 * .45)
    h.state.setPersistentValue(psyloParameterId('fogDensity'), 0); h.publish()
    expect(h.resolver.resolve(target('density').id).value).toBe(0)
    expect(h.resolver.resolve(target('mistAmount').id).value).toBe(0)
    h.state.setPersistentValue(psyloParameterId('mistHeight'), 5); h.publish()
    expect(h.resolver.resolve(target('mistHeight').id).value).toBe(5)
  })
  it('makes scene-light and effects zero/OFF permissions unconditional', () => {
    const h = psyloChoreographyHarness()
    h.state.setPersistentValue(psyloParameterId('lightsEnabled'), false)
    h.state.setPersistentValue(psyloParameterId('master'), 0); h.publish({ build: 1, event: 'drop' })
    for (const t of h.targets) {
      if (t.kind === 'light' && t.ownerId !== 'psylo-fill' && t.ownerId !== 'psylo-moon' && t.property === 'intensity') expect(h.resolver.resolve(t.id).value).toBe(0)
      if ([PSYLO_EFFECT_IDS.atmosphere, PSYLO_EFFECT_IDS.bloom].includes(t.ownerId as typeof PSYLO_EFFECT_IDS.atmosphere) && t.property === 'mix') expect(h.resolver.resolve(t.id).value).toBe(0)
    }
  })
  it('advances opted-in authored mist without analysis and holds on pause/stop', () => {
    const { frame } = psyloChoreographyHarness().publish()
    const idle = { ...frame, audio: null, deltaTimeSec: 0, timestampMs: 200, transport: { ...frame.transport!, sourcePresent: false } }
    expect(cinema2AtmosphereAuthoredDelta(idle, 100)).toBeCloseTo(.1)
    expect(cinema2AtmosphereAuthoredDelta({ ...idle, transport: { ...idle.transport, sourcePresent: true, playing: true } }, 100)).toBeCloseTo(.1)
    expect(cinema2AtmosphereAuthoredDelta({ ...idle, transport: { ...idle.transport, paused: true } }, 100)).toBe(0)
    expect(cinema2AtmosphereAuthoredDelta({ ...idle, transport: { ...idle.transport, sourcePresent: true, playing: false } }, 100)).toBe(0)
    expect(cinema2AtmosphereAuthoredDelta(idle, null)).toBe(0)
  })
})
