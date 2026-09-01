import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_AUDIO_EVENT_SOURCES,
  CINEMATIC_AUDIO_SOURCES,
  CINEMATIC_AUDIO_TARGETS,
  createDefaultCinematicAudioRoutes,
  type CinematicAudioSource,
} from '../../../CinematicWorldConfig'
import { CinematicModulationEngine, type CinematicNormalizedAudioFrame } from '../CinematicAudioModulation'
import {
  createOrbitalPrismComposition,
  ORBITAL_PRISM_MAX_PARTICLES,
  ORBITAL_PRISM_MAX_SHARDS,
  ORBITAL_PRISM_RING_COUNT,
  orbitalPrismArrayWorldDefinition,
  resolveOrbitalPrismQualityCounts,
  resolveOrbitalPrismReactivity,
} from './OrbitalPrismArrayWorld'

describe('Orbital Prism Array composition', () => {
  it('reconstructs the same bounded composition from the same seed', () => {
    const first = createOrbitalPrismComposition(49001)
    const second = createOrbitalPrismComposition(49001)

    expect(Array.from(first.crystalInstances)).toEqual(Array.from(second.crystalInstances))
    expect(Array.from(first.ringInstances)).toEqual(Array.from(second.ringInstances))
    expect(Array.from(first.particles)).toEqual(Array.from(second.particles))
    expect(first.shardCount).toBe(ORBITAL_PRISM_MAX_SHARDS)
    expect(first.particleCount).toBe(ORBITAL_PRISM_MAX_PARTICLES)
  })

  it('changes the seeded shard and particle layout without changing the authored three-ring composition', () => {
    const first = createOrbitalPrismComposition(49001)
    const second = createOrbitalPrismComposition(49002)

    expect(Array.from(first.crystalInstances)).not.toEqual(Array.from(second.crystalInstances))
    expect(Array.from(first.particles)).not.toEqual(Array.from(second.particles))
    expect(Array.from(first.ringInstances)).toEqual(Array.from(second.ringInstances))
    expect(first.ringInstances).toHaveLength(ORBITAL_PRISM_RING_COUNT * 13)
  })

  it('keeps quality-scaled geometry inside the authored live-VJ bounds', () => {
    expect(resolveOrbitalPrismQualityCounts('low')).toEqual({ shardCount: 12, particleCount: 56 })
    expect(resolveOrbitalPrismQualityCounts('medium')).toEqual({ shardCount: 14, particleCount: 80 })
    expect(resolveOrbitalPrismQualityCounts('auto')).toEqual({ shardCount: 15, particleCount: 92 })
    expect(resolveOrbitalPrismQualityCounts('high')).toEqual({ shardCount: 16, particleCount: 108 })
    expect(resolveOrbitalPrismQualityCounts('ultra')).toEqual({ shardCount: ORBITAL_PRISM_MAX_SHARDS, particleCount: ORBITAL_PRISM_MAX_PARTICLES })
  })
})

const ALL_CAPABILITIES: CinematicNormalizedAudioFrame['capabilities'] = {
  musicIntelligence: true,
  broadBands: true,
  detailedBands: true,
  transientEvents: true,
  kickEvents: true,
  snareEvents: true,
  beatTiming: true,
  downbeatTiming: true,
  barTiming: true,
  phraseTiming: true,
  sectionTiming: true,
  buildProgress: true,
  dropState: true,
  trackEnergyCurve: true,
  vocalEnergy: true,
}

function normalizedAudio(
  overrides: Partial<Record<CinematicAudioSource, number>> = {},
): CinematicNormalizedAudioFrame {
  const values = Object.assign(
    Object.fromEntries(CINEMATIC_AUDIO_SOURCES.map(source => [source, 0])) as Record<CinematicAudioSource, number>,
    overrides,
  )
  return {
    frameId: 1,
    sourceId: 'orbital-prism-test-source',
    trackId: 'orbital-prism-test-track',
    transportTimeSec: 1,
    isPlaying: true,
    values,
    events: Object.fromEntries(
      CINEMATIC_AUDIO_EVENT_SOURCES.map(source => [source, values[source] > 0]),
    ) as CinematicNormalizedAudioFrame['events'],
    timing: {
      bpm: 120,
      beatPhase: values.beatPhase,
      beatIndex: 4,
      beatInBar: 0,
      barIndex: 1,
      barPosition: values.barPosition,
      phraseProgress: values.phraseProgress,
    },
    section: {
      type: 'drop',
      label: 'Drop',
      startSec: 0,
      endSec: 16,
      progress: 0.5,
      intensity: 1,
      confidence: 1,
    },
    capabilities: ALL_CAPABILITIES,
    resetReasons: [],
  }
}

function orbitalEngine() {
  return {
    engine: new CinematicModulationEngine(),
    routes: createDefaultCinematicAudioRoutes('orbitalPrismArray'),
    targets: orbitalPrismArrayWorldDefinition.capabilities.modulationTargets,
  }
}

describe('Orbital Prism Array canonical audio reactivity', () => {
  it('uses only supported canonical sources and consumed modulation targets', () => {
    const routes = createDefaultCinematicAudioRoutes('orbitalPrismArray')
    expect(routes.map(route => [route.source, route.target])).toEqual([
      ['bass', 'nodeScale'],
      ['mid', 'geometryRotation'],
      ['highs', 'edgeBrightness'],
      ['highs', 'particleEmission'],
      ['beat', 'impact'],
      ['dropEntry', 'burstImpulse'],
      ['dropEntry', 'bloom'],
    ])
    expect(routes.every(route => orbitalPrismArrayWorldDefinition.capabilities.modulationTargets.includes(route.target))).toBe(true)
  })

  it('keeps silence on the authored visual baseline', () => {
    const { engine, routes, targets } = orbitalEngine()
    const snapshot = engine.update(normalizedAudio(), routes, targets, 1 / 60, 0, 49001)
    const response = resolveOrbitalPrismReactivity(snapshot)

    expect(response).toEqual({
      prismScale: 1,
      prismEnergy: 0,
      ringMotion: 0,
      highEnergy: 0,
      particleEnergy: 0,
      beatPulse: 0,
      dropPulse: 0,
      shardExpansion: 0,
    })
  })

  it('smooths band attacks and keeps max-energy transforms finite and bounded', () => {
    const { engine, routes, targets } = orbitalEngine()
    engine.update(normalizedAudio(), routes, targets, 1 / 60, 0, 49001)
    const first = resolveOrbitalPrismReactivity(engine.update(
      normalizedAudio({ bass: 1, mid: 1, highs: 1 }), routes, targets, 1 / 60, 0, 49001,
    ))
    let sustained = first
    for (let frame = 0; frame < 120; frame += 1) {
      sustained = resolveOrbitalPrismReactivity(engine.update(
        normalizedAudio({ bass: 1, mid: 1, highs: 1 }), routes, targets, 1 / 60, 0, 49001,
      ))
    }

    expect(first.prismScale).toBeGreaterThan(1)
    expect(first.prismScale).toBeLessThan(sustained.prismScale)
    expect(sustained.prismScale).toBeLessThanOrEqual(1.12)
    expect(sustained.ringMotion).toBeGreaterThan(0)
    expect(sustained.ringMotion).toBeLessThanOrEqual(1)
    expect(sustained.highEnergy).toBeGreaterThan(0)
    expect(sustained.highEnergy).toBeLessThanOrEqual(1)
    expect(sustained.particleEnergy).toBeGreaterThan(0)
    expect(Object.values(sustained).every(Number.isFinite)).toBe(true)
  })

  it('decays the canonical beat envelope back to baseline', () => {
    const { engine, routes, targets } = orbitalEngine()
    engine.update(normalizedAudio(), routes, targets, 1 / 60, 0, 49001)
    const hit = resolveOrbitalPrismReactivity(engine.update(
      normalizedAudio({ beat: 1 }), routes, targets, 1 / 60, 0, 49001,
    ))
    let recovered = hit
    for (let frame = 0; frame < 180; frame += 1) {
      recovered = resolveOrbitalPrismReactivity(engine.update(
        normalizedAudio(), routes, targets, 1 / 60, 0, 49001,
      ))
    }

    expect(hit.beatPulse).toBeGreaterThan(0)
    expect(hit.prismScale).toBeGreaterThan(1)
    expect(recovered.beatPulse).toBeLessThan(0.001)
    expect(recovered.prismScale).toBeCloseTo(1, 3)
  })

  it('returns repeated drop expansion to the deterministic base layout without drift', () => {
    const { engine, routes, targets } = orbitalEngine()
    const base = createOrbitalPrismComposition(49001)
    engine.update(normalizedAudio(), routes, targets, 1 / 60, 0, 49001)
    const firstDrop = resolveOrbitalPrismReactivity(engine.update(
      normalizedAudio({ dropEntry: 1 }), routes, targets, 1 / 60, 0, 49001,
    ))
    for (let frame = 0; frame < 12; frame += 1) {
      engine.update(normalizedAudio(), routes, targets, 1 / 60, 0, 49001)
    }
    const repeatedDrop = resolveOrbitalPrismReactivity(engine.update(
      normalizedAudio({ dropEntry: 1 }), routes, targets, 1 / 60, 0, 49001,
    ))
    let recovered = repeatedDrop
    for (let frame = 0; frame < 360; frame += 1) {
      recovered = resolveOrbitalPrismReactivity(engine.update(
        normalizedAudio(), routes, targets, 1 / 60, 0, 49001,
      ))
    }

    expect(firstDrop.shardExpansion).toBeGreaterThan(0)
    expect(repeatedDrop.shardExpansion).toBeGreaterThan(0)
    expect(repeatedDrop.shardExpansion).toBeLessThanOrEqual(0.14)
    expect(recovered.shardExpansion).toBeLessThan(0.001)
    expect(Array.from(createOrbitalPrismComposition(49001).crystalInstances)).toEqual(Array.from(base.crystalInstances))
  })

  it('clamps invalid modulation values before they reach transforms or shader uniforms', () => {
    const values = Object.fromEntries(CINEMATIC_AUDIO_TARGETS.map(target => [target, 0])) as Record<(typeof CINEMATIC_AUDIO_TARGETS)[number], number>
    const response = resolveOrbitalPrismReactivity({
      values: {
        ...values,
        nodeScale: Number.POSITIVE_INFINITY,
        geometryRotation: Number.NaN,
        edgeBrightness: -10,
        particleEmission: 9,
        impact: 7,
        burstImpulse: 4,
      },
      issues: [],
      planKey: 'invalid-input-falsification',
    })

    expect(Object.values(response).every(Number.isFinite)).toBe(true)
    expect(response.prismScale).toBeGreaterThanOrEqual(1)
    expect(response.prismScale).toBeLessThanOrEqual(1.12)
    expect(response.ringMotion).toBe(0)
    expect(response.highEnergy).toBe(0)
    expect(response.particleEnergy).toBe(1)
    expect(response.beatPulse).toBe(1)
    expect(response.dropPulse).toBe(1)
    expect(response.shardExpansion).toBe(0.14)
  })
})
