import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_NUMERIC_RANGES,
  createCinematicSeededRandom,
  createDefaultCinematicWorldConfig,
  normalizeCinematicWorldConfig,
} from '../CinematicWorldConfig'


describe('CinematicWorldConfig', () => {
  it('creates independent legacy-compatible defaults', () => {
    const first = createDefaultCinematicWorldConfig()
    const second = createDefaultCinematicWorldConfig()

    expect(first).toMatchObject({
      schemaVersion: 1,
      worldMode: 'legacyPortal',
      portalShape: 'rectangle',
      cameraRig: 'locked',
      seed: 1337,
      qualityTier: 'high',
    })
    expect(first.audioMapping.routes.length).toBeGreaterThan(0)
    expect(first).not.toBe(second)
    expect(first.audioMapping.routes).not.toBe(second.audioMapping.routes)
  })

  it('normalizes numeric bounds and preserves unknown configuration values', () => {
    const normalized = normalizeCinematicWorldConfig({
      worldMode: 'stormGateway',
      portalShape: 'organic',
      cameraRig: 'autoDirector',
      seed: Number.MAX_SAFE_INTEGER,
      qualityTier: 'ultra',
      futureTopLevel: { enabled: true },
      environment: {
        depth: -10,
        architecture: 10,
        fog: Number.NaN,
        debris: 0.25,
        stars: 0.75,
        atmosphere: 2,
        futureWeather: 'ionized',
      },
      material: {
        distortion: -1,
        refraction: 2,
        bloom: 0.8,
        chromaticAberration: 5,
        feedback: 0.2,
        glow: 0.9,
      },
      audioMapping: {
        enabled: true,
        smoothingMs: 9000,
        routes: [{
          id: 'route-1',
          enabled: true,
          source: 'kick',
          target: 'cameraMotion',
          amount: 8,
          attackMs: -20,
          releaseMs: 9000,
          futureEnvelope: 'curve',
        }],
      },
      transition: {
        mode: 'morph',
        durationMs: 20000,
        easing: 'easeOut',
        preserveCamera: false,
      },
    }, { oldFogDensity: 0.42 })

    expect(normalized.environment.depth).toBe(0)
    expect(normalized.environment.architecture).toBe(1)
    expect(normalized.environment.fog).toBe(CINEMATIC_NUMERIC_RANGES.environment.fog.default)
    expect(normalized.environment.atmosphere).toBe(1)
    expect(normalized.material.distortion).toBe(0)
    expect(normalized.material.refraction).toBe(1)
    expect(normalized.audioMapping.smoothingMs).toBe(2000)
    expect(normalized.audioMapping.routes[0]).toMatchObject({ amount: 2, attackMs: 0, releaseMs: 4000 })
    expect(normalized.transition.durationMs).toBe(10000)
    expect(normalized.seed).toBe(0xffffffff)
    expect(normalized.compatibility.legacyValues.oldFogDensity).toBe(0.42)
    expect(normalized.compatibility.extensions.futureTopLevel).toEqual({ enabled: true })
    expect(normalized.compatibility.extensions['environment.futureWeather']).toBe('ionized')
    expect(normalized.compatibility.extensions['audioMapping.routes.0.futureEnvelope']).toBe('curve')
  })

  it('produces repeatable seeded random sequences', () => {
    const first = createCinematicSeededRandom(42069)
    const second = createCinematicSeededRandom(42069)
    const different = createCinematicSeededRandom(42070)

    const firstSequence = Array.from({ length: 12 }, () => first())
    const secondSequence = Array.from({ length: 12 }, () => second())
    const differentSequence = Array.from({ length: 12 }, () => different())

    expect(firstSequence).toEqual(secondSequence)
    expect(firstSequence).not.toEqual(differentSequence)
    expect(firstSequence.every(value => value >= 0 && value < 1)).toBe(true)
  })
})
