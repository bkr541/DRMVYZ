import { describe, expect, it } from 'vitest'
import { cinema2DepthOfFieldEffectDefinition, CINEMA2_DEPTH_OF_FIELD_SAMPLES } from '../effects/Cinema2DepthOfFieldEffect'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import { cinema2GlareEffectDefinition, CINEMA2_GLARE_TAPS } from '../effects/Cinema2GlareEffect'
import { CINEMA2_THREE_PARTICLE_TIER_SHARE, parseCinema2ThreeParticleSpec } from '../modules/three/Cinema2ThreeParticles'
import { cinema2ThreeSceneModuleDefinition } from '../modules/Cinema2ThreeSceneModule'
import { packCinema2VolumetricLights } from '../effects/Cinema2VolumetricAtmosphereEffect'

const effect = (typeId: string, parameters: Record<string, unknown>) => ({ id: 'e', typeId, version: 1, enabled: true, order: 0, scope: 'output', parameters: { mix: 1, ...parameters } }) as never

describe('glare and depth-of-field effects', () => {
  it('are registered built-in effects that validate their ranges', () => {
    expect(cinema2NativeEffectRegistry.get('glare' as never, 1)).not.toBeNull()
    expect(cinema2NativeEffectRegistry.get('depth-of-field' as never, 1)).not.toBeNull()
    expect(cinema2GlareEffectDefinition.validate!(effect('glare', { threshold: 8, length: 0.04, streaks: 4 }))).toEqual([])
    expect(cinema2GlareEffectDefinition.validate!(effect('glare', { length: 2 })).map(d => d.path)).toEqual(['$.parameters.length'])
    expect(cinema2DepthOfFieldEffectDefinition.validate!(effect('depth-of-field', { focusDistance: 5, focusRange: 2, farBlur: 7 }))).toEqual([])
    expect(cinema2DepthOfFieldEffectDefinition.validate!(effect('depth-of-field', { farBlur: 100 })).map(d => d.path)).toEqual(['$.parameters.farBlur'])
  })

  it('skip themselves on low quality and scale their work with the tier', () => {
    expect(CINEMA2_GLARE_TAPS.low).toBe(0)
    expect(CINEMA2_DEPTH_OF_FIELD_SAMPLES.low).toBe(0)
    expect(CINEMA2_GLARE_TAPS.medium).toBeLessThan(CINEMA2_GLARE_TAPS.high)
    expect(CINEMA2_DEPTH_OF_FIELD_SAMPLES.medium).toBeLessThan(CINEMA2_DEPTH_OF_FIELD_SAMPLES.high)
  })
})

describe('three-scene particle fields', () => {
  const valid = { count: 100, center: [0, 1, 0], size: [4, 2, 4], pointSize: 0.04, color: [1, 0.6, 0.3], brightness: 3 }
  it('parses a field, filling the optional drift, twinkle, reactivity and tint', () => {
    expect(parseCinema2ThreeParticleSpec(valid)).toMatchObject({ count: 100, drift: [0, 0, 0], twinkle: 0, reactivity: 0, tint: 'color' })
    expect(parseCinema2ThreeParticleSpec({ ...valid, tint: 'glow', reactivity: 0.8 })).toMatchObject({ tint: 'glow', reactivity: 0.8 })
  })
  it('rejects bad fields, and the module reports them', () => {
    expect(parseCinema2ThreeParticleSpec({ ...valid, size: [0, 1, 1] })).toBeNull()
    expect(parseCinema2ThreeParticleSpec({ ...valid, color: [2, 0, 0] })).toBeNull()
    expect(parseCinema2ThreeParticleSpec({ ...valid, tint: 'rainbow' })).toBeNull()
    const module = { id: 'm', typeId: 'three-scene', version: 1, enabled: true, config: { instances: [{ asset: 'cinema2-golden-roots', node: 'n' }], particles: [valid, { count: -1 }] } } as never
    expect(cinema2ThreeSceneModuleDefinition.validate!(module).map(d => d.path)).toContain('$.config.particles[1]')
  })
  it('draws the full field on high, half on medium and none on low', () => {
    expect(CINEMA2_THREE_PARTICLE_TIER_SHARE).toEqual({ low: 0, medium: 0.5, high: 1 })
  })
})

describe('volumetric light packing', () => {
  it('leaves lights that are off, or authored out of the haze, out of the haze but not out of the floor lighting', () => {
    const light = (id: string, intensity: number, scatter = true) => ({ id, type: 'point', color: [1, 1, 1, 1], intensity, position: [0, 0, 0], targetPosition: null, direction: [0, -1, 0], spot: null, range: 5, scatter }) as never
    const lights = [light('on', 1), light('off', 0), light('fill', 1, false)]
    expect(packCinema2VolumetricLights(lights, null, true).count).toBe(1)
    expect(packCinema2VolumetricLights(lights, null, false).count).toBe(3)
  })
})
